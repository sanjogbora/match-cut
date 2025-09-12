import { EyePoints, FaceDetectionResult, ResolutionConfig, FaceLandmark } from './types';

// Enhanced alignment with sub-pixel precision and multi-point registration
export class AdvancedImageAligner {
  private targetEyeDistance = 0.35;
  private targetEyeY = 0.4;
  
  // Smoothing parameters for temporal consistency
  private previousTransforms: AlignmentTransform[] = [];
  private smoothingFactor = 0.2; // Lower = more smoothing
  
  constructor(
    targetEyeDistance = 0.35, 
    targetEyeY = 0.4,
    smoothingFactor = 0.2
  ) {
    this.targetEyeDistance = targetEyeDistance;
    this.targetEyeY = targetEyeY;
    this.smoothingFactor = smoothingFactor;
  }

  // Enhanced eye center detection using pupil approximation
  private calculatePreciseEyeCenter(landmarks: FaceLandmark[], eyeIndices: number[]): [number, number] {
    const validLandmarks = eyeIndices
      .map(idx => landmarks[idx])
      .filter(landmark => landmark);

    if (validLandmarks.length === 0) {
      throw new Error('No valid eye landmarks found');
    }

    // Weight landmarks by distance from geometric center for better pupil approximation
    const geometricCenter = [
      validLandmarks.reduce((sum, p) => sum + p.x, 0) / validLandmarks.length,
      validLandmarks.reduce((sum, p) => sum + p.y, 0) / validLandmarks.length
    ];

    // Inner landmarks (closer to pupil) get higher weight
    const innerIndices = eyeIndices.slice(2); // Skip corner landmarks
    let weightedX = 0, weightedY = 0, totalWeight = 0;

    validLandmarks.forEach((landmark, i) => {
      const isInnerLandmark = innerIndices.includes(eyeIndices[i]);
      const weight = isInnerLandmark ? 2.0 : 1.0;
      
      weightedX += landmark.x * weight;
      weightedY += landmark.y * weight;
      totalWeight += weight;
    });

    return [weightedX / totalWeight, weightedY / totalWeight];
  }

  // Multi-point facial alignment using eyes, nose, and mouth
  alignImageMultiPoint(
    sourceImage: HTMLImageElement,
    faceResult: FaceDetectionResult,
    targetResolution: ResolutionConfig
  ): HTMLCanvasElement {
    const { landmarks } = faceResult;
    const { width: canvasWidth, height: canvasHeight } = targetResolution;

    // Enhanced eye detection with better landmark indices
    const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161];
    const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384];
    
    // Nose tip and bridge points for additional stability
    const noseIndices = [1, 2, 5, 6, 19, 20, 94, 125, 141, 235, 236, 237, 238, 239, 240, 241, 242];
    
    try {
      // Calculate precise eye centers
      const leftEyeCenter = this.calculatePreciseEyeCenter(landmarks, leftEyeIndices);
      const rightEyeCenter = this.calculatePreciseEyeCenter(landmarks, rightEyeIndices);
      
      // Calculate nose center for additional alignment constraint
      const noseCenter = this.calculatePreciseEyeCenter(landmarks, noseIndices);

      // Enhanced eye points with sub-pixel precision
      const preciseEyePoints: EyePoints = {
        left: [leftEyeCenter[0] * sourceImage.width, leftEyeCenter[1] * sourceImage.height],
        right: [rightEyeCenter[0] * sourceImage.width, rightEyeCenter[1] * sourceImage.height]
      };

      // Calculate alignment transform with multi-point constraints
      const transform = this.calculateEnhancedTransform(
        preciseEyePoints,
        [noseCenter[0] * sourceImage.width, noseCenter[1] * sourceImage.height],
        { width: canvasWidth, height: canvasHeight }
      );

      // Apply temporal smoothing to reduce jitter
      const smoothedTransform = this.applySmoothening(transform);
      this.previousTransforms.push(smoothedTransform);
      
      // Keep only recent transforms for smoothing
      if (this.previousTransforms.length > 5) {
        this.previousTransforms.shift();
      }

      // Render with sub-pixel precision
      return this.renderWithSubPixelPrecision(sourceImage, smoothedTransform, {
        width: canvasWidth,
        height: canvasHeight
      });

    } catch (error) {
      console.error('Multi-point alignment failed, falling back to basic alignment:', error);
      // Fallback to basic eye alignment
      return this.alignImageBasic(sourceImage, faceResult.eyePoints, targetResolution);
    }
  }

  private calculateEnhancedTransform(
    eyePoints: EyePoints,
    nosePoint: [number, number],
    targetResolution: ResolutionConfig
  ): EnhancedAlignmentTransform {
    const { left, right } = eyePoints;
    const { width, height } = targetResolution;

    // Primary alignment based on eyes (80% weight)
    const eyeCenterX = (left[0] + right[0]) / 2;
    const eyeCenterY = (left[1] + right[1]) / 2;
    const eyeAngle = Math.atan2(right[1] - left[1], right[0] - left[0]);
    const currentEyeDistance = Math.sqrt(
      Math.pow(right[0] - left[0], 2) + Math.pow(right[1] - left[1], 2)
    );

    // Target eye positioning
    const targetEyeDistance = width * this.targetEyeDistance;
    const targetEyeCenterX = width / 2;
    const targetEyeCenterY = height * this.targetEyeY;

    // Primary transform
    const primaryScale = targetEyeDistance / currentEyeDistance;
    const primaryRotation = -eyeAngle;

    // Secondary constraint from nose (20% weight) for better stability
    const noseToEyeVector = [nosePoint[0] - eyeCenterX, nosePoint[1] - eyeCenterY];
    const expectedNoseDistance = targetEyeDistance * 0.6; // Typical nose-to-eye ratio
    const currentNoseDistance = Math.sqrt(noseToEyeVector[0] ** 2 + noseToEyeVector[1] ** 2);
    const noseScale = expectedNoseDistance / currentNoseDistance;

    // Weighted average of scale factors
    const finalScale = primaryScale * 0.8 + noseScale * 0.2;

    return {
      rotation: primaryRotation,
      scale: finalScale,
      translation: [targetEyeCenterX - eyeCenterX * finalScale, targetEyeCenterY - eyeCenterY * finalScale],
      confidence: this.calculateAlignmentConfidence(eyePoints, nosePoint)
    };
  }

  private applySmoothening(transform: EnhancedAlignmentTransform): EnhancedAlignmentTransform {
    if (this.previousTransforms.length === 0) {
      return transform;
    }

    const recent = this.previousTransforms[this.previousTransforms.length - 1];
    const alpha = this.smoothingFactor;

    return {
      rotation: recent.rotation * (1 - alpha) + transform.rotation * alpha,
      scale: recent.scale * (1 - alpha) + transform.scale * alpha,
      translation: [
        recent.translation[0] * (1 - alpha) + transform.translation[0] * alpha,
        recent.translation[1] * (1 - alpha) + transform.translation[1] * alpha
      ],
      confidence: transform.confidence
    };
  }

  private calculateAlignmentConfidence(eyePoints: EyePoints, nosePoint: [number, number]): number {
    // Calculate confidence based on facial feature geometry
    const eyeDistance = Math.sqrt(
      Math.pow(eyePoints.right[0] - eyePoints.left[0], 2) + 
      Math.pow(eyePoints.right[1] - eyePoints.left[1], 2)
    );
    
    const eyeCenter = [(eyePoints.left[0] + eyePoints.right[0]) / 2, (eyePoints.left[1] + eyePoints.right[1]) / 2];
    const noseToEyeDistance = Math.sqrt(
      Math.pow(nosePoint[0] - eyeCenter[0], 2) + 
      Math.pow(nosePoint[1] - eyeCenter[1], 2)
    );

    // Ideal ratio between eye distance and nose-to-eye distance
    const ratio = noseToEyeDistance / eyeDistance;
    const idealRatio = 0.6; // Typical facial proportion
    const ratioConfidence = Math.max(0, 1 - Math.abs(ratio - idealRatio) / idealRatio);

    return Math.min(1, ratioConfidence);
  }

  private renderWithSubPixelPrecision(
    sourceImage: HTMLImageElement,
    transform: EnhancedAlignmentTransform,
    targetResolution: ResolutionConfig
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetResolution.width;
    canvas.height = targetResolution.height;
    const ctx = canvas.getContext('2d')!;

    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    
    // Apply transform with sub-pixel precision
    ctx.translate(transform.translation[0], transform.translation[1]);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scale, transform.scale);
    
    // Center image on canvas
    const centerX = targetResolution.width / (2 * transform.scale);
    const centerY = targetResolution.height / (2 * transform.scale);
    
    ctx.drawImage(
      sourceImage,
      -centerX,
      -centerY
    );
    
    ctx.restore();

    return canvas;
  }

  // Fallback basic alignment method
  private alignImageBasic(
    sourceImage: HTMLImageElement,
    eyePoints: EyePoints,
    targetResolution: ResolutionConfig
  ): HTMLCanvasElement {
    // Simplified version for fallback
    const canvas = document.createElement('canvas');
    canvas.width = targetResolution.width;
    canvas.height = targetResolution.height;
    const ctx = canvas.getContext('2d')!;

    const { left, right } = eyePoints;
    const eyeCenterX = (left[0] + right[0]) / 2;
    const eyeCenterY = (left[1] + right[1]) / 2;
    const eyeAngle = Math.atan2(right[1] - left[1], right[0] - left[0]);
    const currentEyeDistance = Math.sqrt(
      Math.pow(right[0] - left[0], 2) + Math.pow(right[1] - left[1], 2)
    );

    const targetEyeDistance = targetResolution.width * this.targetEyeDistance;
    const scale = targetEyeDistance / currentEyeDistance;

    ctx.save();
    ctx.translate(targetResolution.width / 2, targetResolution.height * this.targetEyeY);
    ctx.rotate(-eyeAngle);
    ctx.scale(scale, scale);
    ctx.drawImage(sourceImage, -eyeCenterX, -eyeCenterY);
    ctx.restore();

    return canvas;
  }

  // Reset smoothing state (call when starting new sequence)
  resetSmoothingState(): void {
    this.previousTransforms = [];
  }
}

interface EnhancedAlignmentTransform {
  rotation: number;
  scale: number;
  translation: [number, number];
  confidence: number;
}

interface AlignmentTransform {
  rotation: number;
  scale: number;
  translation: [number, number];
}