export interface EyePoints {
  left: [number, number];
  right: [number, number];
}

export interface ImageData {
  id: string;
  file: File;
  url: string;
  aligned: boolean;
  eyePoints?: EyePoints;
  faceResult?: FaceDetectionResult;
  alignedCanvas?: HTMLCanvasElement;
  processedUrl?: string;
  error?: string; // Error message if processing failed
  status: 'pending' | 'processing' | 'aligned' | 'failed';
  alignmentConfidence?: number; // Confidence score from 0-1 for alignment quality
  processingTime?: number; // Time taken for processing in milliseconds
}

export interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: string;
  progress: number;
  error?: string;
}

export interface ExportSettings {
  format: 'gif' | 'mp4';
  resolution: '480p' | '720p' | '1080p';
  frameDuration: number;
  addSound: boolean;
  loop: boolean;
  alignmentMode: 'full' | 'face-crop' | 'smart-frame' | 'advanced-multi-point';
}

export interface ResolutionConfig {
  width: number;
  height: number;
}

export const RESOLUTION_CONFIGS: Record<string, ResolutionConfig> = {
  '480p': { width: 640, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

export interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface FaceDetectionResult {
  landmarks: FaceLandmark[];
  eyePoints: EyePoints;
  confidence: number;
  faceBounds?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
}

export interface AlignmentTransform {
  rotation: number;
  scale: number;
  translation: [number, number];
  matrix: number[][];
}

export interface AnimationFrame {
  canvas: HTMLCanvasElement;
  duration: number;
  imageId: string;
}

export interface VideoExportProgress {
  phase: 'preparing' | 'encoding' | 'finalizing' | 'complete';
  progress: number;
  frameCount?: number;
  currentFrame?: number;
}

export type ProcessingStep = 
  | 'idle' 
  | 'detecting_faces' 
  | 'aligning_images' 
  | 'generating_preview' 
  | 'exporting_video' 
  | 'complete' 
  | 'error';

export interface AppState {
  images: ImageData[];
  processingStatus: ProcessingStatus;
  exportSettings: ExportSettings;
  previewFrames: AnimationFrame[];
  isPlaying: boolean;
  currentFrame: number;
}