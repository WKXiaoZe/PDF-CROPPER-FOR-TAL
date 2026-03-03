import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, degrees } from 'pdf-lib';
import { Download, ZoomIn, ZoomOut, Move, AlertCircle, Loader2, Grid3X3 } from 'lucide-react';
import { 
  MM_TO_POINT, CropMode, CROP_MODES
} from '../types';

// Initialize PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfCropperProps {
  file: File;
  mode: CropMode;
}

const PdfCropper: React.FC<PdfCropperProps> = ({ file, mode }) => {
  // Mode Configuration
  const config = CROP_MODES[mode];
  const GRID_COLS = config.gridCols;
  const GRID_ROWS = config.gridRows;
  const CELL_WIDTH_MM = config.cellWidthMm;
  const CELL_HEIGHT_MM = config.cellHeightMm;
  const GRID_WIDTH_MM = CELL_WIDTH_MM * GRID_COLS;
  const GRID_HEIGHT_MM = CELL_HEIGHT_MM * GRID_ROWS;
  const CELL_WIDTH_PT = CELL_WIDTH_MM * MM_TO_POINT;
  const CELL_HEIGHT_PT = CELL_HEIGHT_MM * MM_TO_POINT;
  const GRID_WIDTH_PT = GRID_WIDTH_MM * MM_TO_POINT;
  const GRID_HEIGHT_PT = GRID_HEIGHT_MM * MM_TO_POINT;

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  
  // Crop box position in percentages (0-100) to be responsive
  const [cropPos, setCropPos] = useState({ x: 0, y: 100 }); 
  
  // Refs
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // Ref to the PDF canvas
  
  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; initialLeft: number; initialTop: number }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0
  });

  // Load document success
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  // Load page success to get dimensions
  function onPageLoadSuccess(page: any) {
    setPdfDimensions({ width: page.originalWidth, height: page.originalHeight });
  }

  // Handle container resize to fit PDF
  useEffect(() => {
    if (wrapperRef.current) {
      setAvailableWidth(wrapperRef.current.clientWidth);
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setAvailableWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(wrapperRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Calculate rendered width
  const pdfPageWidth = useMemo(() => {
    const padding = 64; 
    const maxBaseWidth = 800;
    const baseWidth = availableWidth > 0 ? Math.min(availableWidth - padding, maxBaseWidth) : maxBaseWidth;
    return baseWidth * scale;
  }, [availableWidth, scale]);

  // Calculate box pixel size for the ENTIRE GRID
  const boxPixelSize = useMemo(() => {
    if (!pdfDimensions || pdfPageWidth === 0) return { width: 0, height: 0, ratio: 1, renderedWidth: 0, renderedHeight: 0 };
    
    const ratio = pdfPageWidth / pdfDimensions.width;
    
    return {
      width: GRID_WIDTH_PT * ratio,
      height: GRID_HEIGHT_PT * ratio,
      ratio: ratio,
      renderedWidth: pdfPageWidth,
      renderedHeight: pdfDimensions.height * ratio
    };
  }, [pdfDimensions, pdfPageWidth, GRID_WIDTH_PT, GRID_HEIGHT_PT]);

  // Initial positioning logic (Default bottom left)
  useEffect(() => {
    if (boxPixelSize.renderedHeight > 0 && cropPos.y === 100) {
      const initialX = 0; 
      const initialY = boxPixelSize.renderedHeight - boxPixelSize.height; 
      setCropPos({ x: initialX, y: initialY });
    } else if (boxPixelSize.renderedHeight > 0) {
      // Clamp position if box size changes (e.g. mode change)
      setCropPos(prev => {
        const newX = Math.max(0, Math.min(prev.x, boxPixelSize.renderedWidth - boxPixelSize.width));
        const newY = Math.max(0, Math.min(prev.y, boxPixelSize.renderedHeight - boxPixelSize.height));
        if (newX !== prev.x || newY !== prev.y) {
          return { x: newX, y: newY };
        }
        return prev;
      });
    }
  }, [boxPixelSize.renderedHeight, boxPixelSize.height, boxPixelSize.renderedWidth, boxPixelSize.width]);


  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: cropPos.x,
      initialTop: cropPos.y
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragRef.current.isDragging) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    let newX = dragRef.current.initialLeft + deltaX;
    let newY = dragRef.current.initialTop + deltaY;

    newX = Math.max(0, Math.min(newX, boxPixelSize.renderedWidth - boxPixelSize.width));
    newY = Math.max(0, Math.min(newY, boxPixelSize.renderedHeight - boxPixelSize.height));
    setCropPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    dragRef.current.isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // --- Content Detection Logic ---
  const hasContent = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    w: number, 
    h: number
  ): boolean => {
    try {
      // Get pixel data for the cell area
      const imageData = ctx.getImageData(x, y, w, h);
      const data = imageData.data;
      let darkPixelCount = 0;
      
      // Threshold for "darkness". PDF text is usually black (0,0,0).
      // We consider R,G,B all < 200 as "dark enough" to be content (accounting for antialiasing gray).
      // We step by 4 (R,G,B,A)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Simple check: Visible and Dark
        if (a > 50 && r < 200 && g < 200 && b < 200) {
          darkPixelCount++;
        }
      }

      // If we find more than ~100 dark pixels in a 4x3cm area, assume it has content.
      // 4x3cm at screen res is roughly 150x110px = 16500 pixels. 100 pixels is < 1%.
      // This filters out empty white noise but keeps barcodes/text.
      return darkPixelCount > 50; 
    } catch (e) {
      console.warn("Pixel analysis failed", e);
      return true; // Default to keeping if we can't check
    }
  };

  // --- Batch Crop Logic ---
  const handleBatchCrop = async () => {
    if (!file || !pdfDimensions || !canvasRef.current) return;
    setIsProcessing(true);
    setProcessingStatus('正在分析网格内容...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const sourcePage = pages[pageNumber - 1];
      
      const newPdfDoc = await PDFDocument.create();
      let validLabelsCount = 0;

      // Access the canvas context for pixel analysis
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas Context unavailable");

      // Calculate mapping from Visual Box Position (CSS pixels) to Canvas Resolution (Actual pixels)
      // canvas.width is the actual pixel width of the canvas.
      // boxPixelSize.renderedWidth is the CSS width.
      const scaleX = canvas.width / boxPixelSize.renderedWidth;
      const scaleY = canvas.height / boxPixelSize.renderedHeight;

      const ratio = boxPixelSize.ratio; // conversion from Rendered Pixels to PDF Points

      // Iterate through grid cells
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            
          // 1. Calculate visual position relative to the crop box
          const cellVisualX = cropPos.x + (col * (boxPixelSize.width / GRID_COLS));
          const cellVisualY = cropPos.y + (row * (boxPixelSize.height / GRID_ROWS));
          
          const cellVisualW = boxPixelSize.width / GRID_COLS;
          const cellVisualH = boxPixelSize.height / GRID_ROWS;

          // 2. Calculate Canvas coordinates for detection
          const canvasX = Math.floor(cellVisualX * scaleX);
          const canvasY = Math.floor(cellVisualY * scaleY);
          const canvasW = Math.floor(cellVisualW * scaleX);
          const canvasH = Math.floor(cellVisualH * scaleY);

          // 3. Content Detection
          const hasData = hasContent(ctx, canvasX, canvasY, canvasW, canvasH);
          
          if (hasData) {
            validLabelsCount++;
            setProcessingStatus(`处理第 ${validLabelsCount} 个有效标签...`);

            // 4. Calculate PDF Point coordinates for cropping
            // PDF origin (0,0) is bottom-left. 
            // Visual Y is top-down.
            // y_pt = (PageHeight_px - cellVisualY - cellVisualH) / ratio
            const y_bottom_visual = boxPixelSize.renderedHeight - (cellVisualY + cellVisualH);
            
            const x_pt = cellVisualX / ratio;
            const y_pt = y_bottom_visual / ratio;

            // 5. PDF Manipulation
            const [embeddedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNumber - 1]);
            
            embeddedPage.setMediaBox(x_pt, y_pt, CELL_WIDTH_PT, CELL_HEIGHT_PT);
            embeddedPage.setCropBox(x_pt, y_pt, CELL_WIDTH_PT, CELL_HEIGHT_PT);
            
            // Rotate 90 degrees
            const currentRotation = embeddedPage.getRotation().angle;
            embeddedPage.setRotation(degrees(currentRotation + 90));

            newPdfDoc.addPage(embeddedPage);
          }
        }
      }

      if (validLabelsCount === 0) {
        alert("未检测到有效内容，请检查裁切框位置。");
        setIsProcessing(false);
        return;
      }

      // Save and Download
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `batch-labels-${validLabelsCount}pcs-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);

    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('处理失败，请刷新重试');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const changeScale = (delta: number) => {
    setScale(prev => Math.max(0.5, Math.min(3.0, prev + delta)));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Sidebar Controls */}
      <div className="lg:w-80 flex flex-col gap-6 order-2 lg:order-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Grid3X3 size={18} className="text-brand-600" />
            批量裁切控制
          </h3>
          
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 space-y-2">
              <div className="flex justify-between">
                <span>网格尺寸:</span>
                <span className="font-mono font-bold text-slate-900">{GRID_WIDTH_MM}x{GRID_HEIGHT_MM}mm</span>
              </div>
               <div className="flex justify-between">
                <span>单个单元:</span>
                <span className="font-mono font-bold text-slate-900">{CELL_WIDTH_MM}x{CELL_HEIGHT_MM}mm</span>
              </div>
              <div className="flex justify-between">
                <span>网格布局:</span>
                <span className="font-mono font-bold text-slate-900">{GRID_COLS}列 x {GRID_ROWS}行</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-500">
              请将蓝色网格拖动到包含标签的区域。系统会自动识别有内容的格子并分别导出。
            </p>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-600">缩放视图</span>
              <div className="flex items-center gap-2">
                <button onClick={() => changeScale(-0.1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
                  <ZoomOut size={18} />
                </button>
                <span className="text-sm font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => changeScale(0.1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
                  <ZoomIn size={18} />
                </button>
              </div>
            </div>

            {numPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-sm text-slate-600">选择页面</span>
                <div className="flex items-center gap-2">
                   <button 
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber(p => p - 1)}
                    className="px-2 py-1 text-xs border rounded hover:bg-slate-50 disabled:opacity-50"
                   >上一页</button>
                   <span className="text-sm">{pageNumber} / {numPages}</span>
                   <button 
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber(p => p + 1)}
                    className="px-2 py-1 text-xs border rounded hover:bg-slate-50 disabled:opacity-50"
                   >下一页</button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleBatchCrop}
            disabled={isProcessing}
            className="w-full mt-6 bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-lg font-medium shadow-sm shadow-brand-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {processingStatus || '处理中...'}
              </>
            ) : (
              <>
                <Download size={20} />
                批量识别并导出
              </>
            )}
          </button>
          
          <div className="mt-4 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
            <AlertCircle size={14} className="mt-0.5 shrink-0"/>
            <p>生成的 PDF 将包含所有检测到的有效标签，并已自动旋转 90 度。</p>
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <div 
        ref={wrapperRef}
        className="flex-1 bg-slate-200/50 rounded-xl border border-slate-200 overflow-auto p-4 lg:p-8 flex justify-center items-start order-1 lg:order-2 relative" 
        style={{ minHeight: '500px' }}
      >
        <div className="relative shadow-lg bg-white inline-block">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>加载 PDF...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center p-20 text-red-400">
                <AlertCircle size={32} className="mb-2" />
                <p>无法加载 PDF 文件</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              onLoadSuccess={onPageLoadSuccess}
              width={pdfPageWidth || 200}
              canvasRef={canvasRef} // Bind the canvas ref
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>

          {/* Draggable Grid Overlay */}
          {boxPixelSize.width > 0 && (
            <div
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute',
                left: cropPos.x,
                top: cropPos.y,
                width: boxPixelSize.width,
                height: boxPixelSize.height,
                cursor: 'move',
              }}
              className="group z-10 box-content"
            >
              {/* Outer Border */}
              <div className="w-full h-full border-2 border-brand-500 bg-brand-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] relative">
                
                {/* Grid Lines */}
                {/* Vertical Lines - Thickened */}
                {Array.from({ length: GRID_COLS - 1 }).map((_, i) => (
                  <div 
                    key={`v-${i}`} 
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-brand-500"
                    style={{ left: `${((i + 1) / GRID_COLS) * 100}%` }}
                  />
                ))}
                
                {/* Horizontal Lines - Thickened */}
                {Array.from({ length: GRID_ROWS - 1 }).map((_, i) => (
                  <div 
                    key={`h-${i}`} 
                    className="absolute left-0 right-0 border-t-2 border-dashed border-brand-500"
                    style={{ top: `${((i + 1) / GRID_ROWS) * 100}%` }}
                  />
                ))}

                {/* Dimensions Label */}
                <div className="absolute -top-6 left-0 bg-brand-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                  {config.name}
                </div>
                
                {/* Corner Handles */}
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-brand-600"></div>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-600"></div>
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-brand-600"></div>
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-brand-600"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfCropper;