
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  Download,
  Settings,
  RefreshCw,
  FileVideo,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Zap
} from 'lucide-react';
import { ExtractionSettings, ExtractedFrame, VideoMetadata } from './types';
import VideoUploader from './components/VideoUploader';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [settings, setSettings] = useState<ExtractionSettings>({
    fps: 1,
    quality: 0.8,
    format: 'webp',
    startTime: 0,
    endTime: 0
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef(false);
  // Clean up Object URLs to prevent memory leaks
  const clearFrames = useCallback(() => {
    setFrameCount(0);
  }, []);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(
      new URL('./worker/processor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    let frameBuffer: ExtractedFrame[] = [];
    let lastUpdateTime = 0;

    workerRef.current.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'frame-processed') {
        const now = Date.now();
        frameBuffer.push({} as any); // Buffer used for batching updates

        if (now - lastUpdateTime > 150 || frameBuffer.length >= 30) {
          const countToadd = frameBuffer.length;
          setFrameCount(prev => {
            const next = prev + countToadd;
            if (isExtracting) {
              setStatus(`Disk Sync: ${next} frames saved`);
            }
            return next;
          });
          frameBuffer = [];
          lastUpdateTime = now;
        }
      } else if (data.type === 'flush') {
        setFrameCount(prev => {
          const next = prev + frameBuffer.length;
          frameBuffer = [];
          setStatus(`Extraction complete. ${next} frames ready for download.`);
          setIsExtracting(false);
          return next;
        });
      } else if (data.type === 'zip-ready') {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(data.blob);
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatus('Download complete');
        setIsExtracting(false);
      } else if (data.type === 'status') {
        setStatus(data.message);
      } else if (data.type === 'zip-progress') {
        setProgress(Math.round(data.progress));
        setStatus(`Generating ZIP: ${Math.round(data.progress)}%`);
      }
    };

    return () => {
      workerRef.current?.terminate();
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      clearFrames();
    };
  }, []);

  const handleVideoSelect = (file: File) => {
    // 1. Cleanup old resources
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    clearFrames();
    workerRef.current?.postMessage({ type: 'clear' });

    // 2. Create new source
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoSrc(url);
    setProgress(0);
    setStatus('Analyzing video...');

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.muted = true;
    tempVideo.playsInline = true;

    const handleMetadata = () => {
      setMetadata({
        duration: tempVideo.duration,
        width: tempVideo.videoWidth,
        height: tempVideo.videoHeight,
        name: file.name,
        size: file.size
      });
      setSettings(prev => ({
        ...prev,
        endTime: tempVideo.duration,
        startTime: 0
      }));
      setStatus('Ready');
      tempVideo.removeEventListener('loadedmetadata', handleMetadata);
    };

    tempVideo.addEventListener('loadedmetadata', handleMetadata);
    tempVideo.src = url;
    tempVideo.load();
  };

  const extractFrames = async () => {
    if (!videoFile || !metadata || !videoRef.current || !workerRef.current) {
      setStatus('Error: Resources not ready');
      return;
    }

    setIsExtracting(true);
    abortRef.current = false;
    clearFrames();
    workerRef.current.postMessage({ type: 'clear' });
    setProgress(0);
    setStatus('Initializing sequence...');

    const video = videoRef.current;
    const interval = 1 / settings.fps;
    const framesToExtract: number[] = [];

    for (let t = settings.startTime; t < settings.endTime; t += interval) {
      framesToExtract.push(t);
    }

    if (framesToExtract.length === 0 || framesToExtract[framesToExtract.length - 1] < settings.endTime - 0.05) {
      framesToExtract.push(settings.endTime);
    }

    let lastProgressUpdate = 0;

    for (let i = 0; i < framesToExtract.length; i++) {
      if (abortRef.current) {
        setStatus('Extraction stopped');
        break;
      }

      const time = framesToExtract[i];
      video.currentTime = time;

      try {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          // Fallback timeout
          setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          }, 2000);
        });

        // Capture frame as ImageBitmap (much faster than drawing to main-thread canvas)
        const bitmap = await createImageBitmap(video);

        // Offload processing to worker
        workerRef.current.postMessage({
          type: 'process-frame',
          id: i + 1,
          bitmap,
          quality: settings.quality,
          format: settings.format,
          timestamp: time
        }, [bitmap]); // Transfer bitmap to worker

      } catch (err) {
        console.error('Frame extraction failed at', time, err);
      }

      const now = Date.now();
      // Throttle progress updates to 100ms
      if (now - lastProgressUpdate > 100 || i === framesToExtract.length - 1) {
        const p = Math.round(((i + 1) / framesToExtract.length) * 100);
        setProgress(p);
        setStatus(`Processing: ${i + 1} / ${framesToExtract.length}`);
        lastProgressUpdate = now;
      }

      // Small pause every 10 frames to keep the event loop healthy
      if (i % 10 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (!abortRef.current) {
      workerRef.current.postMessage({ type: 'flush-request' });
      // We don't set setIsExtracting(false) here. 
      // We wait for the 'flush' message from the worker to confirm everything is encoded.
      setStatus('Finishing encoding sequence...');
    }
  };

  const handleAbort = () => {
    abortRef.current = true;
    setIsExtracting(false);
  };

  const downloadAsZip = async () => {
    if (frameCount === 0 || !workerRef.current) return;
    setIsExtracting(true); // Show progress bar for ZIP generation
    workerRef.current.postMessage({
      type: 'generate-zip',
      filename: metadata?.name.split('.')[0] || 'frames'
    });
  };


  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar
        settings={settings}
        setSettings={setSettings}
        metadata={metadata}
        isExtracting={isExtracting}
        onExtract={extractFrames}
        onDownload={downloadAsZip}
        onAbort={handleAbort}
        canExtract={!!videoFile && !!metadata}
        frameCount={frameCount}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background ambient glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none"></div>

        <header className="h-24 border-b border-white/5 flex items-center justify-between px-10 shrink-0 bg-transparent backdrop-blur-md z-20">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-white rounded-2xl shadow-[0_0_25px_rgba(255,255,255,0.15)] transform hover:rotate-6 transition-transform">
              <Zap className="w-5 h-5 text-black" fill="black" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight text-white leading-none">
                FrameFlow
              </h1>
              <span className="text-[10px] uppercase tracking-[0.3em] font-medium text-slate-500 mt-2">
                Ultra-Speed Extractions
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {status && (
              <div className={`text-xs font-semibold flex items-center gap-2.5 px-5 py-2 rounded-full glass border transition-all duration-500 ${isExtracting ? 'border-white/20 text-white' : 'border-white/10 text-slate-500'}`}>
                {isExtracting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-white/40" />
                )}
                {status}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 lg:p-14 scroll-smooth custom-scrollbar z-10">
          {!videoFile ? (
            <div className="h-full flex items-center justify-center">
              <VideoUploader onSelect={handleVideoSelect} />
            </div>
          ) : (
            <div className="space-y-12 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 glass-card rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl relative group">
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full aspect-video bg-black/40"
                    controls
                    muted
                    playsInline
                  />
                  {isExtracting && (
                    <div className="absolute inset-0 bg-[#020617]/60 backdrop-blur-[6px] flex flex-col items-center justify-center pointer-events-none transition-all duration-1000">
                      <div className="glass p-10 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col items-center gap-6 scale-100">
                        <RefreshCw className="w-12 h-12 text-white animate-spin opacity-80" />
                        <div className="text-center">
                          <h3 className="text-2xl font-bold text-white mb-1">Processing Asset</h3>
                          <p className="text-slate-500 text-sm font-medium tracking-widest uppercase">{progress}% Completion</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="glass-card rounded-[3rem] border border-white/10 p-10 flex flex-col gap-8 shadow-xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-3 text-slate-400">
                    <FileVideo className="w-4 h-4" />
                    Asset Properties
                  </h3>
                  <div className="space-y-0 text-slate-300">
                    <InfoRow label="Identifier" value={metadata?.name || '---'} />
                    <InfoRow label="Resolution" value={metadata ? `${metadata.width} x ${metadata.height}` : '---'} />
                    <InfoRow label="Temporal" value={metadata ? `${metadata.duration.toFixed(2)}s` : '---'} />
                    <InfoRow label="Compression" value={metadata ? `${(metadata.size / (1024 * 1024)).toFixed(2)} MB` : '---'} />
                  </div>

                  {isExtracting && (
                    <div className="mt-auto space-y-4 pt-10 border-t border-white/5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.2em]">
                        <span className="text-slate-600">Engine Output</span>
                        <span className="text-white">{progress}%</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-white h-full transition-all duration-700 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <button
                        onClick={handleAbort}
                        className="w-full flex items-center justify-center gap-2 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:text-white rounded-2xl transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        Emergency Stop
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold flex items-center gap-4 tracking-tighter">
                    <ImageIcon className="w-8 h-8 text-slate-100" />
                    Activity Monitor
                    <div className="h-8 w-px bg-white/10 mx-2"></div>
                    <span className="text-sm font-medium text-slate-500 uppercase tracking-widest">
                      {frameCount} Units Sync'd
                    </span>
                  </h2>
                </div>

                <div className="glass-card rounded-[4rem] border border-white/5 h-[450px] flex flex-col items-center justify-center text-slate-500 gap-10 bg-white/[0.01] relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none"></div>

                  <div className={`p-10 rounded-[3rem] transition-all duration-1000 ${isExtracting ? 'bg-white/5 scale-110 shadow-[0_0_100px_rgba(255,255,255,0.05)]' : 'bg-white/[0.02]'}`}>
                    {isExtracting ? (
                      <RefreshCw className="w-20 h-20 text-white animate-spin opacity-40" />
                    ) : frameCount > 0 ? (
                      <div className="bg-white p-6 rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                        <CheckCircle2 className="w-12 h-12 text-black" fill="black" />
                      </div>
                    ) : (
                      <Video className="w-20 h-20 opacity-5" />
                    )}
                  </div>
                  <div className="text-center space-y-4 px-10 relative z-10">
                    <p className="text-3xl font-bold text-white tracking-tighter">
                      {isExtracting ? 'Compiling Sequence' : frameCount > 0 ? 'Protocol Complete' : 'Engine Ready'}
                    </p>
                    <p className="text-slate-500 max-w-md mx-auto leading-relaxed font-medium text-sm tracking-wide">
                      {isExtracting
                        ? 'Hardware-accelerated processing active. All data remains encrypted and local.'
                        : frameCount > 0
                          ? `The extraction of ${frameCount} high-fidelity frames is ready. Save the sequence manifest below.`
                          : 'Configure specific temporal ranges and capture frequency to initiate frame sequence protocol.'}
                    </p>
                  </div>
                  {frameCount > 0 && !isExtracting && (
                    <button
                      onClick={downloadAsZip}
                      className="mt-4 px-12 py-5 bg-white text-black font-bold rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_30px_60px_-15px_rgba(255,255,255,0.4)] flex items-center gap-4 relative z-10"
                    >
                      <Download className="w-6 h-6" />
                      Download Manifest ({frameCount} Units)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Offscreen processing happens in the worker */}
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-4 border-b border-white/5 last:border-0 group">
    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest transition-colors group-hover:text-slate-400">{label}</span>
    <span className="text-white text-sm font-semibold truncate max-w-[180px]" title={value}>{value}</span>
  </div>
);

export default App;
