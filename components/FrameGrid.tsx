
import React, { memo, useState, useEffect, useRef, useMemo } from 'react';
import { ExtractedFrame } from '../types';
import { Eye, Download } from 'lucide-react';

interface FrameItemProps {
  frame: ExtractedFrame;
  format: string;
  index: number;
}

const FrameItem = memo(({ frame, format, index }: FrameItemProps) => {
  return (
    <div
      className="group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 transform-gpu"
    >
      {/* Image */}
      <div className="aspect-video relative overflow-hidden bg-black">
        <img
          src={frame.url}
          alt={`Frame ${frame.id}`}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => window.open(frame.url, '_blank')}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-md transition-colors"
            title="View Full Size"
          >
            <Eye className="w-4 h-4 text-white" />
          </button>
          <a
            href={frame.url}
            download={`frame_${String(index + 1).padStart(4, '0')}.${format}`}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            title="Download This Frame"
          >
            <Download className="w-4 h-4 text-white" />
          </a>
        </div>
      </div>

      {/* Info Footer */}
      <div className="p-3 flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold text-indigo-400">
          #{String(frame.id).padStart(3, '0')}
        </span>
        <span className="text-[10px] font-medium text-slate-500">
          {frame.timestamp.toFixed(2)}s
        </span>
      </div>
    </div>
  );
});

interface Props {
  frames: ExtractedFrame[];
  format: string;
}

const FrameGrid: React.FC<Props> = ({ frames, format }) => {
  // Simple pagination/windowing to handle thousands of frames
  const [visibleCount, setVisibleCount] = useState(60);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      // When we are near the bottom, load more frames
      if (scrollHeight - scrollTop <= clientHeight + 1000) {
        setVisibleCount(prev => Math.min(prev + 60, frames.length));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [frames.length]);

  // Reset visible count when frames are cleared
  useEffect(() => {
    if (frames.length === 0) setVisibleCount(60);
    else if (frames.length > visibleCount) {
      // If we just added a bunch, check if we need to show more
      // but generally we want to keep it snappy
    }
  }, [frames.length]);

  const visibleFrames = useMemo(() => frames.slice(0, visibleCount), [frames, visibleCount]);

  return (
    <div ref={containerRef} className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {visibleFrames.map((frame, index) => (
          <FrameItem
            key={frame.id}
            frame={frame}
            format={format}
            index={index}
          />
        ))}
      </div>

      {frames.length > visibleCount && (
        <div className="py-8 flex justify-center">
          <div className="px-6 py-2 bg-slate-900 border border-slate-800 rounded-full text-slate-400 text-sm font-medium animate-pulse">
            Scrolling to load more frames ({frames.length - visibleCount} remaining)...
          </div>
        </div>
      )}
    </div>
  );
};

export default FrameGrid;
