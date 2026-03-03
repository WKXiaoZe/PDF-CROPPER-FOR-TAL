import React, { useState } from 'react';
import { Upload, Scissors, FileCheck, RefreshCw, Grid, Settings } from 'lucide-react';
import FileUploader from './components/FileUploader';
import PdfCropper from './components/PdfCropper';
import { CropMode, CROP_MODES } from './types';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CropMode>('20x6');

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
  };

  const handleReset = () => {
    setFile(null);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-brand-600 text-white p-2 rounded-lg">
              <Grid size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              条码批量裁切 <span className="text-xs font-normal text-slate-500 ml-1 px-2 py-0.5 bg-slate-100 rounded-full">{CROP_MODES[mode].name}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              {(Object.keys(CROP_MODES) as CropMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    mode === m
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {CROP_MODES[m].name}
                </button>
              ))}
            </div>
            {file && (
               <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
              >
                <RefreshCw size={16} />
                重新上传
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
          {!file ? (
            <div className="max-w-2xl mx-auto mt-12">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">上传 PDF 文件</h2>
                <p className="text-slate-500 mb-8">
                  请上传包含多个条码的 PDF。我们将使用 {CROP_MODES[mode].name} 的网格自动识别并提取其中的条码。
                </p>
                <FileUploader onFileSelect={handleFileSelect} />
                
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                  <FeatureItem 
                    icon={<Grid className="text-green-500" size={20}/>}
                    title="网格批量"
                    desc={`使用 ${CROP_MODES[mode].name} 网格，自动分割`}
                  />
                  <FeatureItem 
                    icon={<FileCheck className="text-brand-500" size={20}/>}
                    title="智能过滤"
                    desc="自动跳过空白格子，只保留有内容的条码"
                  />
                  <FeatureItem 
                    icon={<Scissors className="text-purple-500" size={20}/>}
                    title="自动处理"
                    desc="自动裁切 + 旋转90度 + 合并导出"
                  />
                </div>
              </div>
            </div>
          ) : (
            <PdfCropper file={file} mode={mode} />
          )}
        </div>
      </main>
    </div>
  );
};

const FeatureItem = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
    <div className="flex items-center gap-3 mb-1">
      {icon}
      <h3 className="font-semibold text-slate-900">{title}</h3>
    </div>
    <p className="text-xs text-slate-500 ml-8">{desc}</p>
  </div>
);

export default App;