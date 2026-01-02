
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
        w-full max-w-xl p-16 rounded-[4rem] border-2 border-dashed transition-all duration-700
        flex flex-col items-center justify-center text-center cursor-pointer glass-card
        ${isDragging
          ? 'border-white bg-white/10 scale-105'
          : 'border-white/10 bg-white/[0.01] hover:border-white/30 hover:bg-white/[0.03]'}
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

      <div className="w-24 h-24 bg-white/[0.03] rounded-[2rem] flex items-center justify-center mb-10 border border-white/10 shadow-inner group">
        <Upload className="w-10 h-10 text-white opacity-40 group-hover:opacity-100 transition-opacity" />
      </div>

      <h2 className="text-3xl font-bold text-white mb-3 tracking-tighter">Initialize Protocol</h2>
      <p className="text-slate-500 max-w-xs mb-10 text-sm font-medium leading-relaxed">
        Drop high-fidelity video assets here to begin the sequence extraction process.
      </p>

      <button className="px-10 py-4 bg-white hover:scale-105 text-black font-bold rounded-2xl transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] flex items-center gap-3">
        <Video className="w-5 h-5" />
        Choose Source Asset
      </button>
    </div>
  );
};

export default VideoUploader;
