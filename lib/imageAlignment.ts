import { EyePoints, AlignmentTransform, ResolutionConfig, FaceDetectionResult } from './types';

export type AlignmentMode = 'full' | 'face-crop' | 'smart-frame';

export class ImageAligner {
  private targetEyeDistance = 0.35; // Target eye distance as proportion of canvas width
  private targetEyeY = 0.4; // Target eye Y position as proportion of canvas height

  constructor(targetEyeDistance = 0.35, targetEyeY = 0.4) {
    this.targetEyeDistance = targetEyeDistance;
    this.targetEyeY = targetEyeY;
  }

  alignImage(
    sourceImage: HTMLImageElement,
    eyePoints: EyePoints,
    targetResolution: ResolutionConfig
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetResolution.width;
    canvas.height = targetResolution.height;
    const ctx = canvas.getContext('2d')!;

    // Calculate alignment transform
    const transform = this.calculateAlignmentTransform(
      eyePoints,
      targetResolution
    );

    // Apply transformation and draw image
    ctx.save();
    ctx.setTransform(
      transform.matrix[0][0], transform.matrix[0][1],
      transform.matrix[1][0], transform.matrix[1][1],
      transform.matrix[0][2], transform.matrix[1][2]
    );

    ctx.drawImage(sourceImage, 0, 0);
    ctx.restore();

    return canvas;
  }

  private calculateAlignmentTransform(
    eyePoints: EyePoints,
    targetResolution: ResolutionConfig
  ): AlignmentTransform {
    const { left, right } = eyePoints;
    const { width, height } = targetResolution;

    // Calculate current eye properties
    const eyeCenterX = (left[0] + right[0]) / 2;
    const eyeCenterY = (left[1] + right[1]) / 2;
    const currentEyeDistance = Math.sqrt(
      Math.pow(right[0] - left[0], 2) + Math.pow(right[1] - left[1], 2)
    );
    const eyeAngle = Math.atan2(right[1] - left[1], right[0] - left[0]);

    // Calculate target eye properties
    const targetEyeDistancePixels = width * this.targetEyeDistance;
    const targetEyeCenterX = width / 2;
    const targetEyeCenterY = height * this.targetEyeY;

    // Calculate transformations
    const scale = targetEyeDistancePixels / currentEyeDistance;
    const rotation = -eyeAngle; // Negative to counter-rotate

    // Create transformation matrix
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // Translation to center eyes at origin
    const tx1 = -eyeCenterX;
    const ty1 = -eyeCenterY;

    // Scale and rotate
    const scaleRotateMatrix = [
      [scale * cos, -scale * sin],
      [scale * sin, scale * cos]
    ];

    // Translation to target position
    const tx2 = targetEyeCenterX;
    const ty2 = targetEyeCenterY;

    // Combine transformations: translate -> scale/rotate -> translate
    const matrix = [
      [scaleRotateMatrix[0][0], scaleRotateMatrix[0][1], 
       scaleRotateMatrix[0][0] * tx1 + scaleRotateMatrix[0][1] * ty1 + tx2],
      [scaleRotateMatrix[1][0], scaleRotateMatrix[1][1], 
       scaleRotateMatrix[1][0] * tx1 + scaleRotateMatrix[1][1] * ty1 + ty2]
    ];

    return {
      rotation: rotation * (180 / Math.PI), // Convert to degrees
      scale,
      translation: [tx2 - eyeCenterX * scale, ty2 - eyeCenterY * scale],
      matrix
    };
  }

  // Full image alignment method that preserves entire image on canvas
  alignImageFull(
    sourceImage: HTMLImageElement,
    eyePoints: EyePoints,
    targetResolution: ResolutionConfig
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetResolution.width;
    canvas.height = targetResolution.height;
    const ctx = canvas.getContext('2d')!;

    const { left, right } = eyePoints;
    const { width: canvasWidth, height: canvasHeight } = targetResolution;

    // Calculate eye properties in source image
    const eyeCenterX = (left[0] + right[0]) / 2;
    const eyeCenterY = (left[1] + right[1]) / 2;
    const eyeAngle = Math.atan2(right[1] - left[1], right[0] - left[0]);
    const currentEyeDistance = Math.sqrt(
      Math.pow(right[0] - left[0], 2) + Math.pow(right[1] - left[1], 2)
    );

    // Target eye properties on canvas
    const targetEyeDistance = canvasWidth * this.targetEyeDistance;
    const targetEyeCenterX = canvasWidth / 2;
    const targetEyeCenterY = canvasHeight * this.targetEyeY;
    
    // Calculate scale based on eye distance
    const eyeScale = targetEyeDistance / currentEyeDistance;
    
    // Calculate the scaled image dimensions
    const scaledImageWidth = sourceImage.width * eyeScale;
    const scaledImageHeight = sourceImage.height * eyeScale;
    
    // Calculate final scale to fit entire image on canvas if needed
    const canvasFitScaleX = canvasWidth / scaledImageWidth;
    const canvasFitScaleY = canvasHeight / scaledImageHeight;
    const canvasFitScale = Math.min(canvasFitScaleX, canvasFitScaleY, 1); // Don't upscale beyond eye scale
    
    // Final scale combines eye alignment and canvas fitting
    const finalScale = eyeScale * canvasFitScale;
    
    // Calculate where the image should be positioned to keep eyes at target position
    const scaledEyeCenterX = eyeCenterX * finalScale;
    const scaledEyeCenterY = eyeCenterY * finalScale;
    
    // Calculate image position (top-left corner) to place eyes at target position
    const cos = Math.cos(-eyeAngle);
    const sin = Math.sin(-eyeAngle);
    
    // Apply transformations
    ctx.save();
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    console.log('alignImageFull debug:', {
      sourceImageSize: { width: sourceImage.width, height: sourceImage.height },
      canvasSize: { width: canvasWidth, height: canvasHeight },
      eyeScale,
      canvasFitScale,
      finalScale,
      eyeCenterX,
      eyeCenterY,
      targetEyeCenterX,
      targetEyeCenterY,
      eyeAngle: eyeAngle * (180 / Math.PI) + ' degrees',
      imageComplete: sourceImage.complete,
      imageSrc: sourceImage.src.substring(0, 50) + '...'
    });
    
    // Verify source image has content by drawing to a test canvas
    const testCanvas = document.createElement('canvas');
    testCanvas.width = sourceImage.width;
    testCanvas.height = sourceImage.height;
    const testCtx = testCanvas.getContext('2d')!;
    testCtx.drawImage(sourceImage, 0, 0);
    const testImageData = testCtx.getImageData(0, 0, sourceImage.width, sourceImage.height);
    const sourceHasContent = testImageData.data.some((value, index) => {
      return index % 4 === 3 && value > 0; // Check alpha channel
    });
    console.log('Source image has content:', sourceHasContent);
    
    // Move to target eye center
    ctx.translate(targetEyeCenterX, targetEyeCenterY);
    
    // Rotate to align eyes horizontally
    ctx.rotate(-eyeAngle);
    
    // Scale to match target eye distance and fit canvas
    ctx.scale(finalScale, finalScale);
    
    // Draw image centered on eye center in the scaled/rotated coordinate system
    ctx.drawImage(
      sourceImage,
      -eyeCenterX,
      -eyeCenterY,
      sourceImage.width,
      sourceImage.height
    );
    
    console.log('DrawImage parameters:', {
      dx: -eyeCenterX,
      dy: -eyeCenterY, 
      dWidth: sourceImage.width,
      dHeight: sourceImage.height,
      currentTransform: ctx.getTransform()
    });
    
    // Check immediately if drawing worked within the transform
    const immediateCheck = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const drewSomething = immediateCheck.data.some((value, index) => {
      return index % 4 === 3 && value > 0;
    });
    console.log('Content exists immediately after drawImage (within transform):', drewSomething);
    
    ctx.restore();
    
    // Debug: Check if canvas has content
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const hasContent = imageData.data.some((value, index) => {
      return index % 4 === 3 && value > 0; // Check alpha channel for non-transparent pixels
    });
    console.log('Canvas has content after drawing:', hasContent);
    
    if (!hasContent) {
      console.warn('WARNING: Canvas appears to be empty after alignment');
      // Debug: Try a simple red rectangle to verify canvas is working
      ctx.fillStyle = 'red';
      ctx.fillRect(10, 10, 50, 50);
      console.log('Added debug red rectangle to empty canvas');
    }

    return canvas;
  }

  // Smart face cropping alignment - focuses on face region while maintaining eye alignment
  alignImageFaceCrop(
    sourceImage: HTMLImageElement,
    faceResult: FaceDetectionResult,
    targetResolution: ResolutionConfig,
    padding: number = 0.3 // 30% padding around face
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetResolution.width;
    canvas.height = targetResolution.height;
    const ctx = canvas.getContext('2d')!;

    const { eyePoints, faceBounds } = faceResult;
    const { width: canvasWidth, height: canvasHeight } = targetResolution;

    if (!faceBounds) {
      // Fallback to full alignment if no face bounds
      return this.alignImageFull(sourceImage, eyePoints, targetResolution);
    }

    // Calculate padded face region
    const faceWidth = faceBounds.width;
    const faceHeight = faceBounds.height;
    const paddingX = faceWidth * padding;
    const paddingY = faceHeight * padding;

    const cropLeft = Math.max(0, faceBounds.left - paddingX);
    const cropTop = Math.max(0, faceBounds.top - paddingY);
    const cropRight = Math.min(sourceImage.width, faceBounds.right + paddingX);
    const cropBottom = Math.min(sourceImage.height, faceBounds.bottom + paddingY);

    const cropWidth = cropRight - cropLeft;
    const cropHeight = cropBottom - cropTop;

    // Adjust eye points relative to crop region
    const adjustedEyePoints: EyePoints = {
      left: [eyePoints.left[0] - cropLeft, eyePoints.left[1] - cropTop],
      right: [eyePoints.right[0] - cropLeft, eyePoints.right[1] - cropTop]
    };

    // Calculate eye properties in cropped region
    const eyeCenterX = (adjustedEyePoints.left[0] + adjustedEyePoints.right[0]) / 2;
    const eyeCenterY = (adjustedEyePoints.left[1] + adjustedEyePoints.right[1]) / 2;
    const eyeAngle = Math.atan2(
      adjustedEyePoints.right[1] - adjustedEyePoints.left[1],
      adjustedEyePoints.right[0] - adjustedEyePoints.left[0]
    );
    const currentEyeDistance = Math.sqrt(
      Math.pow(adjustedEyePoints.right[0] - adjustedEyePoints.left[0], 2) +
      Math.pow(adjustedEyePoints.right[1] - adjustedEyePoints.left[1], 2)
    );

    // Target eye properties
    const targetEyeDistance = canvasWidth * this.targetEyeDistance;
    const targetEyeCenterX = canvasWidth / 2;
    const targetEyeCenterY = canvasHeight * this.targetEyeY;

    // Calculate scale to fit cropped region to canvas
    const eyeScale = targetEyeDistance / currentEyeDistance;
    const scaleToFitX = canvasWidth / cropWidth;
    const scaleToFitY = canvasHeight / cropHeight;
    const fitScale = Math.min(scaleToFitX, scaleToFitY);
    
    // Use the more appropriate scale
    const finalScale = Math.min(eyeScale, fitScale * 1.2); // Allow slight overflow for better framing

    // Apply transformations
    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    console.log('alignImageFaceCrop debug:', {
      cropRegion: { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight },
      canvasSize: { width: canvasWidth, height: canvasHeight },
      eyeScale,
      fitScale,
      finalScale,
      eyeCenterX,
      eyeCenterY,
      targetEyeCenterX,
      targetEyeCenterY,
      eyeAngle: eyeAngle * (180 / Math.PI) + ' degrees'
    });

    // Move to target eye center
    ctx.translate(targetEyeCenterX, targetEyeCenterY);

    // Rotate to align eyes horizontally
    ctx.rotate(-eyeAngle);

    // Scale the cropped region
    ctx.scale(finalScale, finalScale);

    // Draw the cropped region centered on eye center
    ctx.drawImage(
      sourceImage,
      cropLeft, cropTop, cropWidth, cropHeight, // Source crop
      -eyeCenterX, -eyeCenterY, cropWidth, cropHeight // Destination
    );

    ctx.restore();
    
    // Debug: Check if canvas has content
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const hasContent = imageData.data.some((value, index) => {
      return index % 4 === 3 && value > 0; // Check alpha channel for non-transparent pixels
    });
    console.log('Canvas has content after face crop drawing:', hasContent);
    
    if (!hasContent) {
      console.warn('WARNING: Face crop canvas appears to be empty after alignment');
      // Debug: Try a simple blue rectangle to verify canvas is working
      ctx.fillStyle = 'blue';
      ctx.fillRect(10, 10, 50, 50);
      console.log('Added debug blue rectangle to empty face crop canvas');
    }

    return canvas;
  }

  // Alternative simpler alignment method using canvas transforms
  alignImageSimple(
    sourceImage: HTMLImageElement,
    eyePoints: EyePoints,
    targetResolution: ResolutionConfig
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = targetResolution.width;
    canvas.height = targetResolution.height;
    const ctx = canvas.getContext('2d')!;

    const { left, right } = eyePoints;
    const { width, height } = targetResolution;

    // Calculate eye center and angle
    const eyeCenterX = (left[0] + right[0]) / 2;
    const eyeCenterY = (left[1] + right[1]) / 2;
    const eyeAngle = Math.atan2(right[1] - left[1], right[0] - left[0]);
    const currentEyeDistance = Math.sqrt(
      Math.pow(right[0] - left[0], 2) + Math.pow(right[1] - left[1], 2)
    );

    // Target properties
    const targetEyeDistance = width * this.targetEyeDistance;
    const targetCenterX = width / 2;
    const targetCenterY = height * this.targetEyeY;
    const scale = targetEyeDistance / currentEyeDistance;

    // Apply transformations
    ctx.save();
    
    // Move to target center
    ctx.translate(targetCenterX, targetCenterY);
    
    // Rotate to align eyes horizontally
    ctx.rotate(-eyeAngle);
    
    // Scale to match target eye distance
    ctx.scale(scale, scale);
    
    // Draw image centered on eye center
    ctx.drawImage(
      sourceImage,
      -eyeCenterX,
      -eyeCenterY
    );
    
    ctx.restore();

    return canvas;
  }

  // Method to check if eye points are valid for alignment
  validateEyePoints(eyePoints: EyePoints, imageWidth: number, imageHeight: number): boolean {
    const { left, right } = eyePoints;

    // Check if points are within image bounds
    if (left[0] < 0 || left[0] > imageWidth || left[1] < 0 || left[1] > imageHeight) {
      return false;
    }
    if (right[0] < 0 || right[0] > imageWidth || right[1] < 0 || right[1] > imageHeight) {
      return false;
    }

    // Check if eyes are reasonably far apart
    const eyeDistance = Math.sqrt(
      Math.pow(right[0] - left[0], 2) + Math.pow(right[1] - left[1], 2)
    );
    const minEyeDistance = Math.min(imageWidth, imageHeight) * 0.05; // 5% of smaller dimension
    const maxEyeDistance = Math.max(imageWidth, imageHeight) * 0.8;  // 80% of larger dimension

    return eyeDistance >= minEyeDistance && eyeDistance <= maxEyeDistance;
  }

  // Get preview of alignment transformation
  getAlignmentPreview(
    sourceImage: HTMLImageElement,
    eyePoints: EyePoints,
    targetResolution: ResolutionConfig,
    previewSize = 200
  ): HTMLCanvasElement {
    // Create smaller preview
    const previewResolution = {
      width: previewSize,
      height: (previewSize * targetResolution.height) / targetResolution.width
    };

    return this.alignImageFull(sourceImage, eyePoints, previewResolution);
  }
}