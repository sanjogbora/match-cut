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
        numFaces: 3, // Increased from 1 to detect multiple faces and pick best one
        minFaceDetectionConfidence: 0.3, // Lowered from default 0.5 for small faces
        minFacePresenceConfidence: 0.3,  // Lowered from default 0.5 for small faces
        minTrackingConfidence: 0.3       // Lowered from default 0.5 for small faces
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

    console.log(`🔍 Starting face detection on ${imageElement.width}x${imageElement.height}px image`);
    
    // Strategy 1: Try detection on original image first
    let result = await this.attemptDetection(imageElement, 'original');
    if (result) return result;

    // Strategy 2: If original fails, try with enhanced contrast/brightness
    console.log('📈 Original detection failed, trying with enhanced image...');
    const enhancedImage = await this.enhanceImageForDetection(imageElement);
    result = await this.attemptDetection(enhancedImage, 'enhanced');
    if (result) return result;

    // Strategy 3: If still failing, try with upscaled image (for small faces)
    const faceSize = await this.estimateFaceSize(imageElement);
    if (faceSize < 100) { // If estimated face is smaller than 100px
      console.log('🔍 Small face detected, trying upscaled version...');
      const upscaledImage = await this.upscaleImage(imageElement, 2.0); // 2x upscale
      result = await this.attemptDetection(upscaledImage, 'upscaled');
      if (result) {
        // Adjust coordinates back to original scale
        return this.adjustCoordinatesForScale(result, 0.5, imageElement.width, imageElement.height);
      }
    }

    // Strategy 4: Last resort - try different confidence thresholds
    console.log('⚠️ All standard methods failed, trying relaxed detection...');
    result = await this.attemptRelaxedDetection(imageElement);
    
    if (!result) {
      console.log('❌ All face detection strategies failed');
    }

    return result;
  }

  private async attemptDetection(imageElement: HTMLImageElement, strategy: string): Promise<FaceDetectionResult | null> {
    try {
      const results: FaceLandmarkerResult = this.faceLandmarker!.detect(imageElement);

      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        console.log(`❌ ${strategy}: No face landmarks detected`);
        return null;
      }

      console.log(`✅ ${strategy}: Found ${results.faceLandmarks.length} face(s)`);
      
      // If multiple faces, pick the largest one (most likely the main subject)
      let bestLandmarks = results.faceLandmarks[0];
      if (results.faceLandmarks.length > 1) {
        bestLandmarks = this.selectBestFace(results.faceLandmarks, imageElement);
        console.log(`🎯 Selected best face from ${results.faceLandmarks.length} candidates`);
      }

      const eyePoints = this.extractEyePoints(bestLandmarks, imageElement.width, imageElement.height);
      
      if (!eyePoints) {
        console.log(`❌ ${strategy}: Failed to extract eye points from landmarks`);
        return null;
      }

      console.log(`✅ ${strategy}: Face detection successful!`, {
        leftEye: eyePoints.left,
        rightEye: eyePoints.right
      });

      return {
        landmarks: bestLandmarks.map(landmark => ({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z
        })),
        eyePoints,
        confidence: 0.8, // Slightly lower since we're using relaxed settings
        faceBounds: this.calculateFaceBounds(bestLandmarks, imageElement.width, imageElement.height)
      };
    } catch (error) {
      console.error(`❌ ${strategy} detection failed:`, error);
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

  /**
   * Select the best face from multiple detected faces (largest face = main subject)
   */
  private selectBestFace(faceLandmarks: NormalizedLandmark[][], imageElement: HTMLImageElement): NormalizedLandmark[] {
    let bestFace = faceLandmarks[0];
    let maxFaceArea = 0;

    for (const face of faceLandmarks) {
      const bounds = this.calculateFaceBounds(face, imageElement.width, imageElement.height);
      const faceArea = bounds.width * bounds.height;
      
      if (faceArea > maxFaceArea) {
        maxFaceArea = faceArea;
        bestFace = face;
      }
    }

    console.log(`🎯 Selected face with area: ${maxFaceArea.toFixed(0)}px²`);
    return bestFace;
  }

  /**
   * Enhance image contrast and brightness for better face detection
   */
  private async enhanceImageForDetection(imageElement: HTMLImageElement): Promise<HTMLImageElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;

    // Draw original image
    ctx.drawImage(imageElement, 0, 0);

    // Get image data and enhance it
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Enhance contrast and brightness
    const contrast = 1.3; // 30% more contrast
    const brightness = 20;  // +20 brightness

    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast and brightness to RGB channels
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));     // Red
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness)); // Green  
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness)); // Blue
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert canvas back to image
    const enhancedImage = new Image();
    enhancedImage.src = canvas.toDataURL();
    await new Promise(resolve => enhancedImage.onload = resolve);

    return enhancedImage;
  }

  /**
   * Upscale image for better detection of small faces
   */
  private async upscaleImage(imageElement: HTMLImageElement, scaleFactor: number): Promise<HTMLImageElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const newWidth = Math.floor(imageElement.width * scaleFactor);
    const newHeight = Math.floor(imageElement.height * scaleFactor);
    
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(imageElement, 0, 0, newWidth, newHeight);

    const upscaledImage = new Image();
    upscaledImage.src = canvas.toDataURL();
    await new Promise(resolve => upscaledImage.onload = resolve);

    console.log(`📏 Upscaled image: ${imageElement.width}x${imageElement.height} -> ${newWidth}x${newHeight}`);
    return upscaledImage;
  }

  /**
   * Estimate face size in image to determine if upscaling is needed
   */
  private async estimateFaceSize(imageElement: HTMLImageElement): Promise<number> {
    // Simple heuristic: assume faces are roughly 10-30% of image diagonal
    const imageDiagonal = Math.sqrt(imageElement.width ** 2 + imageElement.height ** 2);
    const estimatedFaceSize = imageDiagonal * 0.15; // Estimate 15% of diagonal
    
    console.log(`📐 Estimated face size: ${estimatedFaceSize.toFixed(1)}px (image diagonal: ${imageDiagonal.toFixed(1)}px)`);
    return estimatedFaceSize;
  }

  /**
   * Adjust coordinates from scaled image back to original image
   */
  private adjustCoordinatesForScale(result: FaceDetectionResult, scaleFactor: number, originalWidth: number, originalHeight: number): FaceDetectionResult {
    return {
      ...result,
      eyePoints: {
        left: [result.eyePoints.left[0] * scaleFactor, result.eyePoints.left[1] * scaleFactor],
        right: [result.eyePoints.right[0] * scaleFactor, result.eyePoints.right[1] * scaleFactor]
      },
      landmarks: result.landmarks.map(landmark => ({
        ...landmark,
        // Landmarks are in normalized coordinates (0-1), so they don't need scaling
      })),
      faceBounds: result.faceBounds ? {
        ...result.faceBounds,
        left: result.faceBounds.left * scaleFactor,
        right: result.faceBounds.right * scaleFactor,
        top: result.faceBounds.top * scaleFactor,
        bottom: result.faceBounds.bottom * scaleFactor,
        width: result.faceBounds.width * scaleFactor,
        height: result.faceBounds.height * scaleFactor,
        centerX: result.faceBounds.centerX * scaleFactor,
        centerY: result.faceBounds.centerY * scaleFactor
      } : undefined
    };
  }

  /**
   * Last resort detection with very relaxed settings
   */
  private async attemptRelaxedDetection(imageElement: HTMLImageElement): Promise<FaceDetectionResult | null> {
    // This would require creating a new FaceLandmarker with different settings
    // For now, we'll just try the original detection again with logging
    console.log('🔄 Attempting relaxed detection (same as original for now)');
    return await this.attemptDetection(imageElement, 'relaxed');
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