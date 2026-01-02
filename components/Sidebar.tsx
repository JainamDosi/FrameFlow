
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
  onClose?: () => void;
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
  onClose,
  canExtract,
  frameCount
}) => {
  return (
    <aside className="w-[85vw] sm:w-80 lg:w-96 h-screen glass border-r border-white/5 flex flex-col shrink-0 overflow-y-auto z-30 shadow-2xl lg:shadow-none">
      <div className="p-8 lg:p-10 border-b border-white/5">
        <div className="flex items-center justify-between mb-8 lg:mb-12">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
            <Sliders className="w-3.5 h-3.5" />
            Capture Protocol
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-white transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-8 lg:space-y-10">
          {/* FPS Settings */}
          <div className="space-y-5">
            <div className="flex justify-between items-end">
              <label className="text-[11px] font-bold text-white uppercase tracking-widest opacity-40">Frequency</label>
              <span className="text-xs font-bold text-white px-2.5 py-1 bg-white/5 rounded-lg border border-white/10 tabular-nums">
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
              className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-widest">
              <span>Low Density</span>
              <span>Ultra Fluid</span>
            </div>
          </div>

          {/* Quality Settings */}
          <div className="space-y-5">
            <div className="flex justify-between items-end">
              <label className="text-[11px] font-bold text-white uppercase tracking-widest opacity-40">Fidelity</label>
              <span className="text-xs font-bold text-white px-2.5 py-1 bg-white/5 rounded-lg border border-white/10 tabular-nums">
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
              className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-white"
            />
          </div>

          {/* Range Settings */}
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-white uppercase tracking-widest opacity-40">Extraction Range</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Entry</span>
                <input
                  type="number"
                  value={settings.startTime}
                  min="0"
                  step="0.1"
                  max={metadata?.duration || 0}
                  onChange={(e) => setSettings(s => ({ ...s, startTime: Math.max(0, parseFloat(e.target.value)) }))}
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-white/20 focus:bg-white/[0.05] outline-none transition-all tabular-nums font-medium"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Exit</span>
                <input
                  type="number"
                  value={settings.endTime}
                  min="0"
                  step="0.1"
                  max={metadata?.duration || 0}
                  onChange={(e) => setSettings(s => ({ ...s, endTime: Math.min(metadata?.duration || 0, parseFloat(e.target.value)) }))}
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-white/20 focus:bg-white/[0.05] outline-none transition-all tabular-nums font-medium"
                />
              </div>
            </div>
          </div>

          {/* Format Settings */}
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-white uppercase tracking-widest opacity-40">Output Format</label>
            <div className="grid grid-cols-3 gap-3">
              {(['webp', 'png', 'jpeg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSettings(s => ({ ...s, format: fmt }))}
                  className={`
                    py-3 rounded-[1rem] text-[10px] uppercase font-bold tracking-widest transition-all border
                    ${settings.format === fmt
                      ? 'bg-white border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                      : 'bg-white/[0.02] border-white/5 text-slate-500 hover:bg-white/[0.05] hover:text-white'}
                  `}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-8 lg:p-10 space-y-4 bg-transparent border-t border-white/5">
        {isExtracting ? (
          <button
            onClick={onAbort}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-xs uppercase tracking-widest bg-white/[0.05] hover:bg-white/10 text-white border border-white/5 active:scale-[0.98] transition-all"
          >
            <XCircle className="w-5 h-5 text-slate-400" />
            Abort Capture
          </button>
        ) : (
          <button
            onClick={onExtract}
            disabled={!canExtract}
            className={`
              w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all
              ${!canExtract
                ? 'bg-white/[0.02] text-slate-700 cursor-not-allowed border border-white/5'
                : 'bg-white hover:scale-[1.02] text-black shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] active:scale-[0.98]'}
            `}
          >
            <Layers className="w-5 h-5" />
            Initiate Extraction
          </button>
        )}

        <button
          onClick={onDownload}
          disabled={frameCount === 0 || isExtracting}
          className={`
            w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border
            ${frameCount === 0 || isExtracting
              ? 'bg-transparent text-slate-800 border-white/5 cursor-not-allowed opacity-20'
              : 'bg-white/5 hover:bg-white/10 text-white border-white/10 active:scale-[0.98]'}
          `}
        >
          <Download className="w-5 h-5" />
          Sync to Local ({frameCount})
        </button>

        <div className="flex items-center gap-3 justify-center pt-6 text-slate-600 opacity-50">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Edge-Direct Processing</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
