
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

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const data = e.data;

    if (data.type === 'process-frame') {
        const { id, bitmap, quality, format, timestamp } = data;

        // Create offscreen canvas
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            self.postMessage({ type: 'error', message: 'Failed to get canvas context' });
            return;
        }

        ctx.drawImage(bitmap, 0, 0);
        bitmap.close(); // Free memory immediately

        const blob = await canvas.convertToBlob({
            type: `image/${format}`,
            quality
        });

        // Add to zip immediately to avoid keeping blobs in main memory if possible
        const frameFilename = `frame_${String(id).padStart(4, '0')}.${format}`;
        framesFolder?.file(frameFilename, blob);

        // Send back the blob URL for preview
        const url = URL.createObjectURL(blob);
        self.postMessage({
            type: 'frame-processed',
            id,
            url,
            timestamp,
            blob // Optional: we might not need to send the blob back if ZIP is handled here
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
