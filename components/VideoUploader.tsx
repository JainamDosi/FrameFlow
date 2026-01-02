
import React, { useRef, useState } from 'react';
import { Upload, Video, FileWarning } from 'lucide-react';

interface Props {
  onSelect: (file: File) => void;
}

const VideoUploader: React.FC<Props> = ({ onSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        onSelect(file);
      } else {
        alert('Please select a valid video file.');
      }
    }
  };

  return (
    <div 
      className={`
        w-full max-w-xl p-12 rounded-3xl border-2 border-dashed transition-all duration-300
        flex flex-col items-center justify-center text-center cursor-pointer
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/10 scale-105' 
          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'}
      `}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFile(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={inputRef} 
        className="hidden" 
        accept="video/*"
        onChange={(e) => handleFile(e.target.files)}
      />
      
      <div className="w-20 h-20 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
        <Upload className="w-10 h-10 text-indigo-500" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">Drop your video here</h2>
      <p className="text-slate-400 max-w-xs mb-8">
        MP4, WebM, or MOV files are supported.
      </p>

      <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/20 flex items-center gap-2">
        <Video className="w-5 h-5" />
        Choose Video
      </button>
    </div>
  );
};

export default VideoUploader;
