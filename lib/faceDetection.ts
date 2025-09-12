import {
  FaceLandmarker,
  FilesetResolver,
  NormalizedLandmark,
  FaceLandmarkerResult
} from '@mediapipe/tasks-vision';
import { FaceDetectionResult, EyePoints } from './types';

export interface FaceBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export class FaceDetector {
  private faceLandmarker: FaceLandmarker | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: 'IMAGE',
        numFaces: 1
      });

      this.isInitialized = true;
      console.log('MediaPipe Face Landmarker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MediaPipe Face Landmarker:', error);
      throw new Error('Failed to initialize face detection service');
    }
  }

  async detectFace(imageElement: HTMLImageElement): Promise<FaceDetectionResult | null> {
    if (!this.isInitialized || !this.faceLandmarker) {
      throw new Error('Face detector not initialized');
    }

    try {
      console.log(`Detecting face in image ${imageElement.width}x${imageElement.height}`);
      const results: FaceLandmarkerResult = this.faceLandmarker.detect(imageElement);

      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        console.log('No face landmarks detected');
        return null;
      }

      console.log(`Found ${results.faceLandmarks.length} face(s)`);
      const landmarks = results.faceLandmarks[0];
      const eyePoints = this.extractEyePoints(landmarks, imageElement.width, imageElement.height);
      
      if (!eyePoints) {
        console.log('Failed to extract eye points from landmarks');
        return null;
      }

      console.log('Face detection successful', {
        leftEye: eyePoints.left,
        rightEye: eyePoints.right
      });

      return {
        landmarks: landmarks.map(landmark => ({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z
        })),
        eyePoints,
        confidence: 0.9, // MediaPipe doesn't provide confidence score directly
        faceBounds: this.calculateFaceBounds(landmarks, imageElement.width, imageElement.height)
      };
    } catch (error) {
      console.error('Face detection failed:', error);
      return null;
    }
  }

  private extractEyePoints(
    landmarks: NormalizedLandmark[], 
    imageWidth: number, 
    imageHeight: number
  ): EyePoints | null {
    try {
      // MediaPipe face landmark indices for more accurate eye detection
      // Left eye landmarks: 33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
      // Right eye landmarks: 362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
      
      // Use multiple points for more stable eye center calculation
      const leftEyePoints = [
        landmarks[33],   // Left eye outer corner
        landmarks[133],  // Left eye inner corner
        landmarks[159],  // Left eye center-top
        landmarks[145],  // Left eye center-bottom
      ];
      
      const rightEyePoints = [
        landmarks[362],  // Right eye inner corner
        landmarks[263],  // Right eye outer corner  
        landmarks[386],  // Right eye center-top
        landmarks[374],  // Right eye center-bottom
      ];

      // Validate all required landmarks exist
      if (leftEyePoints.some(point => !point) || rightEyePoints.some(point => !point)) {
        console.log('Missing eye landmarks:', {
          leftMissing: leftEyePoints.filter(p => !p).length,
          rightMissing: rightEyePoints.filter(p => !p).length
        });
        
        // Fallback to just main eye corners if detailed landmarks are missing
        const leftEyeOuter = landmarks[33];
        const leftEyeInner = landmarks[133];
        const rightEyeInner = landmarks[362];
        const rightEyeOuter = landmarks[263];
        
        if (!leftEyeOuter || !leftEyeInner || !rightEyeInner || !rightEyeOuter) {
          console.log('Even basic eye landmarks are missing');
          return null;
        }
        
        console.log('Using fallback eye detection with basic landmarks');
        const leftEyeCenter: [number, number] = [
          ((leftEyeOuter.x + leftEyeInner.x) / 2) * imageWidth,
          ((leftEyeOuter.y + leftEyeInner.y) / 2) * imageHeight
        ];

        const rightEyeCenter: [number, number] = [
          ((rightEyeInner.x + rightEyeOuter.x) / 2) * imageWidth,
          ((rightEyeInner.y + rightEyeOuter.y) / 2) * imageHeight
        ];

        return {
          left: leftEyeCenter,
          right: rightEyeCenter
        };
      }

      // Calculate more accurate eye centers using multiple landmarks
      const leftEyeCenter: [number, number] = [
        (leftEyePoints.reduce((sum, point) => sum + point.x, 0) / leftEyePoints.length) * imageWidth,
        (leftEyePoints.reduce((sum, point) => sum + point.y, 0) / leftEyePoints.length) * imageHeight
      ];

      const rightEyeCenter: [number, number] = [
        (rightEyePoints.reduce((sum, point) => sum + point.x, 0) / rightEyePoints.length) * imageWidth,
        (rightEyePoints.reduce((sum, point) => sum + point.y, 0) / rightEyePoints.length) * imageHeight
      ];

      return {
        left: leftEyeCenter,
        right: rightEyeCenter
      };
    } catch (error) {
      console.error('Failed to extract eye points:', error);
      return null;
    }
  }

  private calculateFaceBounds(
    landmarks: NormalizedLandmark[],
    imageWidth: number,
    imageHeight: number
  ): FaceBounds {
    // Key face boundary landmarks in MediaPipe
    const faceBoundaryIndices = [
      10,   // Face top (forehead)
      152,  // Face bottom (chin)
      234,  // Face left
      454,  // Face right
      109, 10, 151, // Additional top points
      175, 199, 208, // Additional bottom points
      127, 162, 21, 54, // Additional left points
      356, 389, 251, 284 // Additional right points
    ];

    const validLandmarks = faceBoundaryIndices
      .map(index => landmarks[index])
      .filter(landmark => landmark);

    if (validLandmarks.length === 0) {
      // Fallback to full image if no landmarks
      return {
        left: 0,
        right: imageWidth,
        top: 0,
        bottom: imageHeight,
        width: imageWidth,
        height: imageHeight,
        centerX: imageWidth / 2,
        centerY: imageHeight / 2
      };
    }

    // Find face boundaries
    const left = Math.min(...validLandmarks.map(p => p.x)) * imageWidth;
    const right = Math.max(...validLandmarks.map(p => p.x)) * imageWidth;
    const top = Math.min(...validLandmarks.map(p => p.y)) * imageHeight;
    const bottom = Math.max(...validLandmarks.map(p => p.y)) * imageHeight;

    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2
    };
  }

  cleanup(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
    this.isInitialized = false;
  }

  isReady(): boolean {
    return this.isInitialized && this.faceLandmarker !== null;
  }
}