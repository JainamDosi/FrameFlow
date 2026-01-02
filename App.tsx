
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
import FrameGrid from './components/FrameGrid';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
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
    setExtractedFrames(prev => {
      prev.forEach(frame => {
        if (frame.url) URL.revokeObjectURL(frame.url);
      });
      return [];
    });
  }, []);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(
      new URL('./worker/processor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    let frameBuffer: ExtractedFrame[] = [];
    let lastUpdateTime = 0;
    let totalProcessed = 0;

    workerRef.current.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'frame-processed') {
        const frame: ExtractedFrame = {
          id: data.id,
          blob: data.blob,
          url: data.url,
          timestamp: data.timestamp
        };

        frameBuffer.push(frame);
        totalProcessed++;

        const now = Date.now();
        // Dynamic batching for better UX:
        // 1. First frame is shown immediately
        // 2. Next 10 frames shown as they come
        // 3. Then batch every 100ms or 20 frames
        const shouldUpdate =
          totalProcessed === 1 ||
          (totalProcessed < 10 && frameBuffer.length >= 1) ||
          (now - lastUpdateTime > 100) ||
          (frameBuffer.length >= 20);

        if (shouldUpdate) {
          const chunk = [...frameBuffer];
          setExtractedFrames(prev => [...prev, ...chunk]);
          frameBuffer = [];
          lastUpdateTime = now;
          setStatus(`Processing: ${totalProcessed} frames encoded...`);
        }
      } else if (data.type === 'flush') {
        if (frameBuffer.length > 0) {
          const chunk = [...frameBuffer];
          setExtractedFrames(prev => [...prev, ...chunk]);
          frameBuffer = [];
        }
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
      setStatus('Extraction complete. Ready for download.');
      setIsExtracting(false);
    }
  };

  const handleAbort = () => {
    abortRef.current = true;
    setIsExtracting(false);
  };

  const downloadAsZip = async () => {
    if (extractedFrames.length === 0 || !workerRef.current) return;
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
        frameCount={extractedFrames.length}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 shrink-0 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              FrameFlow
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {status && (
              <div className={`text-sm font-medium flex items-center gap-2 px-3 py-1 rounded-full border ${isExtracting ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-slate-800/50 text-slate-400'}`}>
                {isExtracting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                {status}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 scroll-smooth custom-scrollbar">
          {!videoFile ? (
            <div className="h-full flex items-center justify-center">
              <VideoUploader onSelect={handleVideoSelect} />
            </div>
          ) : (
            <div className="space-y-8 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl group relative">
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full aspect-video bg-black"
                    controls
                    muted
                    playsInline
                  />
                  {isExtracting && (
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none">
                      <div className="bg-slate-900/90 p-6 rounded-2xl border border-slate-700 shadow-2xl flex flex-col items-center gap-4">
                        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                        <span className="text-lg font-bold">Extracting Sequence</span>
                        <span className="text-slate-400 text-sm font-mono">{progress}% Complete</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col gap-6 shadow-xl">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                    <FileVideo className="w-5 h-5 text-indigo-400" />
                    Video Info
                  </h3>
                  <div className="space-y-1">
                    <InfoRow label="Filename" value={metadata?.name || 'Loading...'} />
                    <InfoRow label="Resolution" value={metadata ? `${metadata.width} x ${metadata.height}` : '...'} />
                    <InfoRow label="Duration" value={metadata ? `${metadata.duration.toFixed(2)}s` : '...'} />
                    <InfoRow label="File Size" value={metadata ? `${(metadata.size / (1024 * 1024)).toFixed(2)} MB` : '...'} />
                  </div>

                  {isExtracting && (
                    <div className="mt-auto space-y-3 pt-6 border-t border-slate-800">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Progress</span>
                        <span className="text-indigo-400 font-bold">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full transition-all duration-300 shadow-[0_0_15px_rgba(79,70,229,0.6)]"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <button
                        onClick={handleAbort}
                        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-rose-400 border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel Extraction
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ImageIcon className="w-6 h-6 text-indigo-400" />
                    Sequence Preview
                    <span className="ml-2 px-3 py-1 text-xs bg-slate-800 text-slate-400 rounded-full border border-slate-700">
                      {extractedFrames.length} Frames
                    </span>
                  </h2>
                </div>

                {extractedFrames.length > 0 ? (
                  <FrameGrid frames={extractedFrames} format={settings.format} />
                ) : (
                  <div className="border-2 border-dashed border-slate-800 rounded-3xl h-64 flex flex-col items-center justify-center text-slate-500 gap-4 bg-slate-900/30">
                    <div className="p-4 bg-slate-800/50 rounded-2xl">
                      <ImageIcon className="w-10 h-10 opacity-30" />
                    </div>
                    <p className="font-medium text-slate-400">Run extraction to see frames here</p>
                  </div>
                )}
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
  <div className="flex justify-between items-center py-2.5 border-b border-slate-800/50 last:border-0">
    <span className="text-slate-500 text-sm font-medium">{label}</span>
    <span className="text-slate-300 text-sm font-semibold truncate max-w-[180px]" title={value}>{value}</span>
  </div>
);

export default App;
