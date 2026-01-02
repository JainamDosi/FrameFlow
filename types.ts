
export interface ExtractionSettings {
  fps: number;
  quality: number;
  format: 'webp' | 'png' | 'jpeg';
  startTime: number;
  endTime: number;
}

export interface ExtractedFrame {
  id: number;
  blob: Blob;
  url: string;
  timestamp: number;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  name: string;
  size: number;
}
