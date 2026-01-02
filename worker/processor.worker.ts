
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

interface ClearRequest {
    type: 'clear';
}

interface GetFrameRequest {
    type: 'get-frame';
    id: number;
}

type WorkerRequest = ProcessRequest | ZipRequest | ClearRequest | FlushRequest | GetFrameRequest;

let zip = new JSZip();
let framesFolder = zip.folder("extracted_frames");

let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

// IndexedDB Setup for persistent storage
const DB_NAME = 'FrameFlow_Storage';
const STORE_NAME = 'frames';
let db: IDBDatabase | null = null;

const initDB = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
};

const saveFrame = (id: number, blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(blob, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const getFrame = (id: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const clearDB = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    if (!db) await initDB();
    const data = e.data;

    if (data.type === 'process-frame') {
        const { id, bitmap, quality, format, timestamp } = data;

        if (!offscreenCanvas || offscreenCanvas.width !== bitmap.width || offscreenCanvas.height !== bitmap.height) {
            offscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
        }

        if (!offscreenCtx) return;

        offscreenCtx.drawImage(bitmap, 0, 0);
        bitmap.close();

        const blob = await offscreenCanvas.convertToBlob({ type: `image/${format}`, quality });

        await saveFrame(id, blob);
        const frameFilename = `frame_${String(id).padStart(4, '0')}.${format}`;
        framesFolder?.file(frameFilename, blob);

        self.postMessage({
            type: 'frame-processed',
            id,
            timestamp
        });
    }

    if (data.type === 'get-frame') {
        try {
            const blob = await getFrame(data.id);
            const url = URL.createObjectURL(blob);
            self.postMessage({ type: 'frame-data', id: data.id, url });
        } catch (err) {
            console.error('Failed to get frame from IDB', err);
        }
    }

    if (data.type === 'flush-request') {
        self.postMessage({ type: 'flush' });
    }

    if (data.type === 'generate-zip') {
        self.postMessage({ type: 'status', message: 'Merging frames into ZIP archive...' });
        const content = await zip.generateAsync({
            type: "blob",
            compression: "STORE"
        }, (metadata) => {
            self.postMessage({ type: 'zip-progress', progress: metadata.percent });
        });
        self.postMessage({ type: 'zip-ready', blob: content, filename: `${data.filename}_sequence.zip` });
    }

    if (data.type === 'clear') {
        zip = new JSZip();
        framesFolder = zip.folder("extracted_frames");
        await clearDB();
    }
};
