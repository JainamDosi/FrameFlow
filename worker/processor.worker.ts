
import JSZip from 'jszip';

interface ProcessRequest {
    type: 'process-frame';
    id: number;
    bitmap: ImageBitmap;
    quality: number;
    format: 'webp' | 'png' | 'jpeg';
    timestamp: number;
}

interface ZipRequest {
    type: 'generate-zip';
    filename: string;
}

interface FlushRequest {
    type: 'flush-request';
}

type WorkerRequest = ProcessRequest | ZipRequest | ClearRequest | FlushRequest;

let zip = new JSZip();
let framesFolder = zip.folder("extracted_frames");

// Reuse canvas and context to avoid memory thrashing
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const data = e.data;

    if (data.type === 'process-frame') {
        const { id, bitmap, quality, format, timestamp } = data;

        // Initialize or resize canvas if needed
        if (!offscreenCanvas || offscreenCanvas.width !== bitmap.width || offscreenCanvas.height !== bitmap.height) {
            offscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
        }

        if (!offscreenCtx) {
            self.postMessage({ type: 'error', message: 'Failed to get canvas context' });
            return;
        }

        offscreenCtx.drawImage(bitmap, 0, 0);
        bitmap.close(); // Crucial: release GPU memory immediately

        const blob = await offscreenCanvas.convertToBlob({
            type: `image/${format}`,
            quality
        });

        // Add to zip immediately
        const frameFilename = `frame_${String(id).padStart(4, '0')}.${format}`;
        framesFolder?.file(frameFilename, blob);

        const url = URL.createObjectURL(blob);
        self.postMessage({
            type: 'frame-processed',
            id,
            url,
            timestamp
        });
    }

    if (data.type === 'generate-zip') {
        self.postMessage({ type: 'status', message: 'Generating ZIP archive...' });

        const content = await zip.generateAsync({
            type: "blob",
            compression: "STORE" // Faster generation as images are already compressed
        }, (metadata) => {
            self.postMessage({ type: 'zip-progress', progress: metadata.percent });
        });

        self.postMessage({
            type: 'zip-ready',
            blob: content,
            filename: `${data.filename}_sequence.zip`
        });
    }

    if (data.type === 'flush-request') {
        self.postMessage({ type: 'flush' });
    }

    if (data.type === 'clear') {
        zip = new JSZip();
        framesFolder = zip.folder("extracted_frames");
    }
};
