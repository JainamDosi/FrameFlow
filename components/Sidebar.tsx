
import React from 'react';
import { Settings, Download, XCircle, Clock, Layers, Sliders } from 'lucide-react';
import { ExtractionSettings, VideoMetadata } from '../types';

interface Props {
  settings: ExtractionSettings;
  setSettings: React.Dispatch<React.SetStateAction<ExtractionSettings>>;
  metadata: VideoMetadata | null;
  isExtracting: boolean;
  onExtract: () => void;
  onDownload: () => void;
  onAbort: () => void;
  canExtract: boolean;
  frameCount: number;
}

const Sidebar: React.FC<Props> = ({ 
  settings, 
  setSettings, 
  metadata, 
  isExtracting, 
  onExtract, 
  onDownload, 
  onAbort,
  canExtract,
  frameCount
}) => {
  return (
    <aside className="w-full lg:w-80 h-auto lg:h-screen bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-8">
          <Sliders className="w-4 h-4" />
          Configuration
        </h2>

        <div className="space-y-8">
          {/* FPS Settings */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Frequency</label>
              <span className="text-sm font-bold text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded-md border border-indigo-500/20">
                {settings.fps} FPS
              </span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="60" 
              step="0.1"
              value={settings.fps}
              onChange={(e) => setSettings(s => ({ ...s, fps: parseFloat(e.target.value) }))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono uppercase">
              <span>Low Res</span>
              <span>Smooth</span>
            </div>
          </div>

          {/* Quality Settings */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quality</label>
              <span className="text-sm font-bold text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded-md border border-indigo-500/20">
                {Math.round(settings.quality * 100)}%
              </span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1.0" 
              step="0.05"
              value={settings.quality}
              onChange={(e) => setSettings(s => ({ ...s, quality: parseFloat(e.target.value) }))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          {/* Range Settings */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Temporal Range</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Start</span>
                <input 
                  type="number" 
                  value={settings.startTime}
                  min="0"
                  step="0.1"
                  max={metadata?.duration || 0}
                  onChange={(e) => setSettings(s => ({ ...s, startTime: Math.max(0, parseFloat(e.target.value)) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold">End</span>
                <input 
                  type="number" 
                  value={settings.endTime}
                  min="0"
                  step="0.1"
                  max={metadata?.duration || 0}
                  onChange={(e) => setSettings(s => ({ ...s, endTime: Math.min(metadata?.duration || 0, parseFloat(e.target.value)) }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Format Settings */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Export Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(['webp', 'png', 'jpeg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSettings(s => ({ ...s, format: fmt }))}
                  className={`
                    py-2.5 rounded-xl text-xs font-bold transition-all border
                    ${settings.format === fmt 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40' 
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'}
                  `}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 space-y-3 bg-slate-950/40 border-t border-slate-800">
        {isExtracting ? (
          <button 
            onClick={onAbort}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-900/20 active:scale-[0.98] transition-all"
          >
            <XCircle className="w-5 h-5" />
            Stop Extraction
          </button>
        ) : (
          <button 
            onClick={onExtract}
            disabled={!canExtract}
            className={`
              w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all
              ${!canExtract 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20 active:scale-[0.98] border border-indigo-500/50'}
            `}
          >
            <Layers className="w-5 h-5" />
            Start Extraction
          </button>
        )}

        <button 
          onClick={onDownload}
          disabled={frameCount === 0 || isExtracting}
          className={`
            w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all border
            ${frameCount === 0 || isExtracting 
              ? 'bg-slate-900 text-slate-700 border-slate-800 cursor-not-allowed' 
              : 'bg-slate-100 hover:bg-white text-slate-950 border-white shadow-xl active:scale-[0.98]'}
          `}
        >
          <Download className="w-5 h-5" />
          Download ZIP ({frameCount})
        </button>

        <div className="flex items-center gap-2 justify-center pt-2 text-slate-600">
           <Clock className="w-3 h-3" />
           <span className="text-[10px] font-medium uppercase tracking-tight">Local Processing Only</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
