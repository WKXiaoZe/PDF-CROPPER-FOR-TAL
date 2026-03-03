import React, { useRef, useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        onFileSelect(droppedFile);
      } else {
        alert('请只上传 PDF 文件');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer
        border-2 border-dashed rounded-xl p-10
        flex flex-col items-center justify-center
        transition-all duration-200 ease-in-out
        ${isDragging 
          ? 'border-brand-500 bg-brand-50' 
          : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
        }
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept="application/pdf"
        className="hidden"
      />
      
      <div className={`
        p-4 rounded-full mb-4 transition-colors duration-200
        ${isDragging ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-500'}
      `}>
        {isDragging ? <UploadCloud size={32} /> : <FileText size={32} />}
      </div>
      
      <p className="text-lg font-medium text-slate-700 mb-1">
        点击或拖拽 PDF 文件至此处
      </p>
      <p className="text-sm text-slate-400">
        支持 PDF 格式
      </p>
    </div>
  );
};

export default FileUploader;