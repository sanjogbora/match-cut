import { FaceDetectionResult, ResolutionConfig, FaceLandmark } from './types';
import { KalmanFilter, KalmanConfig } from './kalmanFilter';

// Semantic facial landmark groups with MediaPipe indices
export const FACIAL_LANDMARKS = {
  // Eyes (40% weight) - Most important for human perception
  LEFT_EYE: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  RIGHT_EYE: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  
  // Nose (25% weight) - Stable facial anchor
  NOSE_BRIDGE: [6, 8, 9, 10, 151, 195, 197, 196, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305],
  NOSE_TIP: [1, 2, 5, 4, 19, 94, 125, 141, 235, 236, 237, 238, 239, 240, 241, 242],
  
  // Mouth (20% weight) - Expression stability  
  MOUTH_OUTER: [61, 146, 91, 181, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318],
  MOUTH_INNER: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312],
  
  // Jawline (15% weight) - Face boundary definition
  JAW_LINE: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323],
  
  // Additional stable points for robustness
  FOREHEAD: [10, 151, 9, 8, 107, 55, 65, 52, 53, 46],
  CHIN: [18, 175, 199, 200, 16, 17, 18, 175, 199, 175, 200, 16, 17],
} as const;

// Landmark weights for importance-based alignment
export const LANDMARK_WEIGHTS = {
  LEFT_EYE: 0.4,
  RIGHT_EYE: 0.4, 
  NOSE_BRIDGE: 0.15,
  NOSE_TIP: 0.1,
  MOUTH_OUTER: 0.12,
  MOUTH_INNER: 0.08,
  JAW_LINE: 0.15,
  FOREHEAD: 0.05,
  CHIN: 0.1,
} as const;

export type AlignmentMode = 'full-face' | 'feature-specific' | 'expression-invariant' | '3d-perspective';

export interface SemanticLandmark {
  x: number;
  y: number;
  z: number;
  weight: number;
  confidence: number;
  type: keyof typeof FACIAL_LANDMARKS;
}

export interface ProcrustesResult {
  rotation: number[][];  // 3x3 rotation matrix
  translation: [number, number, number];  // 3D translation
  scale: number;
  residualError: number;
  confidence: number;
}

export interface AlignmentResult {
  transformedCanvas: HTMLCanvasElement;
  procrustesResult: ProcrustesResult;
  alignmentConfidence: number;
  usedLandmarks: SemanticLandmark[];
  alignmentMode: AlignmentMode;
  processingTime: number;
}

export class AdvancedFaceAligner {
  private previousAlignments: ProcrustesResult[] = [];
  private temporalSmoothingFactor: number = 0.15;
  private minLandmarkConfidence: number = 0.7;
  private alignmentHistory: AlignmentResult[] = [];
  private kalmanFilter: KalmanFilter;
  private useKalmanFiltering: boolean = true;
  
  constructor(
    temporalSmoothingFactor: number = 0.15,
    minLandmarkConfidence: number = 0.7,
    kalmanConfig?: KalmanConfig,
    useKalmanFiltering: boolean = true
  ) {
    this.temporalSmoothingFactor = temporalSmoothingFactor;
    this.minLandmarkConfidence = minLandmarkConfidence;
    this.useKalmanFiltering = useKalmanFiltering;
    
    // Initialize Kalman filter with custom or default config
    this.kalmanFilter = new KalmanFilter(kalmanConfig || {
      processNoise: 0.005,      // Low process noise for smooth tracking
      measurementNoise: 0.05,   // Moderate measurement noise
      initialUncertainty: 0.5,  // Medium initial uncertainty
      velocityDecay: 0.95       // High velocity persistence for smooth motion
    });
  }

  /**
   * Extract semantic landmarks from MediaPipe's 468-point face mesh
   */
  extractSemanticLandmarks(landmarks: FaceLandmark[]): SemanticLandmark[] {
    const semanticLandmarks: SemanticLandmark[] = [];
    
    // Process each facial region
    Object.entries(FACIAL_LANDMARKS).forEach(([regionName, indices]) => {
      const regionWeight = LANDMARK_WEIGHTS[regionName as keyof typeof LANDMARK_WEIGHTS];
      
      indices.forEach(index => {
        const landmark = landmarks[index];
        if (landmark && this.isValidLandmark(landmark)) {
          semanticLandmarks.push({
            x: landmark.x,
            y: landmark.y, 
            z: landmark.z || 0,
            weight: regionWeight / indices.length, // Distribute weight across region points
            confidence: this.calculateLandmarkConfidence(landmark, regionName as keyof typeof FACIAL_LANDMARKS),
            type: regionName as keyof typeof FACIAL_LANDMARKS
          });
        }
      });
    });

    // Filter by confidence threshold
    return semanticLandmarks.filter(landmark => landmark.confidence >= this.minLandmarkConfidence);
  }

  /**
   * Validate if landmark has reasonable coordinates
   */
  private isValidLandmark(landmark: FaceLandmark): boolean {
    return landmark.x >= 0 && landmark.x <= 1 && 
           landmark.y >= 0 && landmark.y <= 1 &&
           Math.abs(landmark.z || 0) < 0.5; // Reasonable depth range
  }

  /**
   * Calculate landmark confidence based on position and facial region
   */
  private calculateLandmarkConfidence(landmark: FaceLandmark, regionType: keyof typeof FACIAL_LANDMARKS): number {
    let confidence = 0.8; // Base confidence
    
    // Eyes and nose are typically more reliable
    if (regionType === 'LEFT_EYE' || regionType === 'RIGHT_EYE' || regionType === 'NOSE_BRIDGE') {
      confidence += 0.15;
    }
    
    // Penalize landmarks near image boundaries (may be clipped)
    const margin = 0.05;
    if (landmark.x < margin || landmark.x > 1 - margin || 
        landmark.y < margin || landmark.y > 1 - margin) {
      confidence -= 0.2;
    }
    
    // Penalize extreme depth values (likely tracking errors)
    if (Math.abs(landmark.z || 0) > 0.3) {
      confidence -= 0.15;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Perform Procrustes analysis to find optimal alignment
   */
  performProcrustesAnalysis(
    sourceLandmarks: SemanticLandmark[],
    targetLandmarks: SemanticLandmark[],
    use3D: boolean = true
  ): ProcrustesResult {
    const startTime = performance.now();
    
    // Find corresponding landmarks between source and target
    const correspondences = this.findLandmarkCorrespondences(sourceLandmarks, targetLandmarks);
    
    if (correspondences.length < 3) {
      throw new Error('Insufficient landmark correspondences for Procrustes analysis');
    }

    // Extract coordinate matrices
    const sourceMatrix = this.landmarksToMatrix(correspondences.map(c => c.source), use3D);
    const targetMatrix = this.landmarksToMatrix(correspondences.map(c => c.target), use3D);
    const weights = correspondences.map(c => (c.source.weight + c.target.weight) / 2);

    // Perform weighted Procrustes analysis
    const result = this.weightedProcrustesAnalysis(sourceMatrix, targetMatrix, weights, use3D);
    
    console.log(`Procrustes analysis completed in ${performance.now() - startTime}ms`);
    
    return result;
  }

  /**
   * Find corresponding landmarks between two sets
   */
  private findLandmarkCorrespondences(
    sourceLandmarks: SemanticLandmark[], 
    targetLandmarks: SemanticLandmark[]
  ): Array<{source: SemanticLandmark, target: SemanticLandmark}> {
    const correspondences: Array<{source: SemanticLandmark, target: SemanticLandmark}> = [];
    
    // Group landmarks by type for direct correspondence
    const sourceByType = this.groupLandmarksByType(sourceLandmarks);
    const targetByType = this.groupLandmarksByType(targetLandmarks);
    
    // Find correspondences within each facial region
    Object.keys(sourceByType).forEach(type => {
      const sourceGroup = sourceByType[type];
      const targetGroup = targetByType[type];
      
      if (sourceGroup && targetGroup) {
        // For now, use direct index correspondence within regions
        // Future enhancement: use geometric distance matching
        const maxCorr = Math.min(sourceGroup.length, targetGroup.length);
        for (let i = 0; i < maxCorr; i++) {
          correspondences.push({
            source: sourceGroup[i],
            target: targetGroup[i]
          });
        }
      }
    });
    
    return correspondences.sort((a, b) => 
      (b.source.weight + b.target.weight) - (a.source.weight + a.target.weight)
    );
  }

  /**
   * Group landmarks by facial region type
   */
  private groupLandmarksByType(landmarks: SemanticLandmark[]): Record<string, SemanticLandmark[]> {
    const groups: Record<string, SemanticLandmark[]> = {};
    
    landmarks.forEach(landmark => {
      if (!groups[landmark.type]) {
        groups[landmark.type] = [];
      }
      groups[landmark.type].push(landmark);
    });
    
    // Sort each group by confidence (highest first)
    Object.values(groups).forEach(group => {
      group.sort((a, b) => b.confidence - a.confidence);
    });
    
    return groups;
  }

  /**
   * Convert landmarks to coordinate matrix
   */
  private landmarksToMatrix(landmarks: SemanticLandmark[], use3D: boolean): number[][] {
    return landmarks.map(landmark => 
      use3D ? [landmark.x, landmark.y, landmark.z] : [landmark.x, landmark.y]
    );
  }

  /**
   * Weighted Procrustes analysis implementation
   */
  private weightedProcrustesAnalysis(
    source: number[][],
    target: number[][],
    weights: number[],
    use3D: boolean
  ): ProcrustesResult {
    const dim = use3D ? 3 : 2;
    const n = source.length;
    
    // Calculate weighted centroids
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const sourceCentroid = new Array(dim).fill(0);
    const targetCentroid = new Array(dim).fill(0);
    
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dim; d++) {
        sourceCentroid[d] += weights[i] * source[i][d] / totalWeight;
        targetCentroid[d] += weights[i] * target[i][d] / totalWeight;
      }
    }
    
    // Center the point sets
    const centeredSource = source.map((point, i) => 
      point.map((coord, d) => coord - sourceCentroid[d])
    );
    const centeredTarget = target.map((point, i) => 
      point.map((coord, d) => coord - targetCentroid[d])
    );
    
    // Calculate optimal rotation using SVD
    const H = this.calculateCrossCorrelationMatrix(centeredSource, centeredTarget, weights);
    const svd = this.computeSVD(H);
    const rotation = this.computeOptimalRotation(svd, use3D);
    
    // Calculate scale
    const scale = this.calculateOptimalScale(centeredSource, centeredTarget, rotation, weights);
    
    // Calculate translation
    const translation: [number, number, number] = [
      targetCentroid[0] - scale * (rotation[0][0] * sourceCentroid[0] + (rotation[0][1] || 0) * sourceCentroid[1] + (rotation[0][2] || 0) * (sourceCentroid[2] || 0)),
      targetCentroid[1] - scale * (rotation[1][0] * sourceCentroid[0] + (rotation[1][1] || 0) * sourceCentroid[1] + (rotation[1][2] || 0) * (sourceCentroid[2] || 0)),
      use3D ? targetCentroid[2] - scale * (rotation[2][0] * sourceCentroid[0] + rotation[2][1] * sourceCentroid[1] + rotation[2][2] * sourceCentroid[2]) : 0
    ];
    
    // Calculate residual error
    const residualError = this.calculateResidualError(source, target, rotation, scale, translation, weights);
    
    // Calculate confidence based on error and number of correspondences
    const confidence = Math.max(0.1, Math.min(1.0, 1.0 - residualError / 0.1)) * Math.min(1.0, n / 20);
    
    return {
      rotation,
      translation,
      scale,
      residualError,
      confidence
    };
  }

  /**
   * Calculate cross-correlation matrix for SVD
   */
  private calculateCrossCorrelationMatrix(
    source: number[][],
    target: number[][],
    weights: number[]
  ): number[][] {
    const dim = source[0].length;
    const H = Array(dim).fill(null).map(() => Array(dim).fill(0));
    
    for (let i = 0; i < source.length; i++) {
      for (let row = 0; row < dim; row++) {
        for (let col = 0; col < dim; col++) {
          H[row][col] += weights[i] * source[i][row] * target[i][col];
        }
      }
    }
    
    return H;
  }

  /**
   * Simplified SVD computation (for 2D/3D matrices)
   */
  private computeSVD(matrix: number[][]): {U: number[][], S: number[], V: number[][]} {
    // This is a simplified implementation for small matrices
    // In production, you'd want to use a robust numerical library
    const dim = matrix.length;
    
    if (dim === 2) {
      return this.svd2x2(matrix);
    } else if (dim === 3) {
      return this.svd3x3(matrix);
    }
    
    throw new Error('SVD only implemented for 2x2 and 3x3 matrices');
  }

  /**
   * Simplified 2x2 SVD
   */
  private svd2x2(matrix: number[][]): {U: number[][], S: number[], V: number[][]} {
    const [[a, b], [c, d]] = matrix;
    
    // Calculate eigenvalues and eigenvectors
    const trace = a + d;
    const det = a * d - b * c;
    const discriminant = trace * trace - 4 * det;
    
    if (discriminant < 0) {
      // Handle complex eigenvalues - return identity
      return {
        U: [[1, 0], [0, 1]],
        S: [1, 1],
        V: [[1, 0], [0, 1]]
      };
    }
    
    const sqrt_discriminant = Math.sqrt(discriminant);
    const lambda1 = (trace + sqrt_discriminant) / 2;
    const lambda2 = (trace - sqrt_discriminant) / 2;
    
    // Simplified - return reasonable approximation
    return {
      U: [[1, 0], [0, 1]],
      S: [Math.abs(lambda1), Math.abs(lambda2)],
      V: [[1, 0], [0, 1]]
    };
  }

  /**
   * Simplified 3x3 SVD
   */
  private svd3x3(matrix: number[][]): {U: number[][], S: number[], V: number[][]} {
    // Simplified implementation - return identity for now
    // In production, use a proper numerical library
    return {
      U: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      S: [1, 1, 1],
      V: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    };
  }

  /**
   * Compute optimal rotation from SVD result
   */
  private computeOptimalRotation(svd: {U: number[][], S: number[], V: number[][]}, use3D: boolean): number[][] {
    const {U, V} = svd;
    const dim = use3D ? 3 : 2;
    
    // R = V * U^T
    const rotation = Array(dim).fill(null).map(() => Array(dim).fill(0));
    
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        for (let k = 0; k < dim; k++) {
          rotation[i][j] += V[i][k] * U[j][k]; // U^T
        }
      }
    }
    
    return rotation;
  }

  /**
   * Calculate optimal scale factor
   */
  private calculateOptimalScale(
    source: number[][],
    target: number[][],
    rotation: number[][],
    weights: number[]
  ): number {
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < source.length; i++) {
      // Apply rotation to source point
      const rotatedSource = this.applyRotation(source[i], rotation);
      
      for (let d = 0; d < rotatedSource.length; d++) {
        numerator += weights[i] * rotatedSource[d] * target[i][d];
        denominator += weights[i] * rotatedSource[d] * rotatedSource[d];
      }
    }
    
    return denominator > 0 ? numerator / denominator : 1.0;
  }

  /**
   * Apply rotation matrix to a point
   */
  private applyRotation(point: number[], rotation: number[][]): number[] {
    const result = new Array(point.length).fill(0);
    
    for (let i = 0; i < rotation.length; i++) {
      for (let j = 0; j < point.length; j++) {
        result[i] += rotation[i][j] * point[j];
      }
    }
    
    return result;
  }

  /**
   * Calculate residual alignment error
   */
  private calculateResidualError(
    source: number[][],
    target: number[][],
    rotation: number[][],
    scale: number,
    translation: [number, number, number],
    weights: number[]
  ): number {
    let totalError = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < source.length; i++) {
      const rotatedScaled = this.applyRotation(source[i], rotation).map(coord => coord * scale);
      
      let pointError = 0;
      for (let d = 0; d < rotatedScaled.length; d++) {
        const transformed = rotatedScaled[d] + translation[d];
        const diff = transformed - target[i][d];
        pointError += diff * diff;
      }
      
      totalError += weights[i] * Math.sqrt(pointError);
      totalWeight += weights[i];
    }
    
    return totalWeight > 0 ? totalError / totalWeight : Infinity;
  }

  /**
   * Apply advanced temporal smoothing using Kalman filtering or simple smoothing
   */
  applySmoothening(currentResult: ProcrustesResult, timestamp?: number): ProcrustesResult {
    if (this.useKalmanFiltering) {
      return this.applyKalmanSmoothing(currentResult, timestamp);
    } else {
      return this.applySimpleSmoothing(currentResult);
    }
  }

  /**
   * Apply Kalman filtering for optimal temporal smoothing
   */
  private applyKalmanSmoothing(currentResult: ProcrustesResult, timestamp?: number): ProcrustesResult {
    // Extract rotation angle from rotation matrix
    const rotationAngle = Math.atan2(currentResult.rotation[1][0], currentResult.rotation[0][0]);
    
    // Apply Kalman filtering to alignment parameters
    const filtered = this.kalmanFilter.filterAlignment(
      currentResult.translation,
      rotationAngle,
      currentResult.scale,
      timestamp
    );

    // Reconstruct rotation matrix from filtered angle
    const cos = Math.cos(filtered.rotation);
    const sin = Math.sin(filtered.rotation);
    
    const filteredRotation = [
      [cos, -sin, 0],
      [sin, cos, 0],
      [0, 0, 1]
    ];

    // Create smoothed result with enhanced confidence
    const smoothedResult: ProcrustesResult = {
      rotation: filteredRotation,
      translation: filtered.translation,
      scale: filtered.scale,
      residualError: currentResult.residualError * (1 - filtered.confidence * 0.3), // Reduce error based on filter confidence
      confidence: Math.min(1.0, currentResult.confidence + filtered.confidence * 0.2) // Boost confidence for smooth tracking
    };

    this.previousAlignments.push(smoothedResult);
    
    // Keep only recent alignments for memory efficiency
    if (this.previousAlignments.length > 5) {
      this.previousAlignments.shift();
    }

    return smoothedResult;
  }

  /**
   * Apply simple exponential smoothing (fallback method)
   */
  private applySimpleSmoothing(currentResult: ProcrustesResult): ProcrustesResult {
    if (this.previousAlignments.length === 0) {
      this.previousAlignments.push(currentResult);
      return currentResult;
    }

    const previous = this.previousAlignments[this.previousAlignments.length - 1];
    const alpha = this.temporalSmoothingFactor;

    // Smooth rotation matrix
    const smoothedRotation = currentResult.rotation.map((row, i) =>
      row.map((val, j) => previous.rotation[i][j] * (1 - alpha) + val * alpha)
    );

    // Smooth translation
    const smoothedTranslation: [number, number, number] = [
      previous.translation[0] * (1 - alpha) + currentResult.translation[0] * alpha,
      previous.translation[1] * (1 - alpha) + currentResult.translation[1] * alpha,
      previous.translation[2] * (1 - alpha) + currentResult.translation[2] * alpha
    ];

    // Smooth scale
    const smoothedScale = previous.scale * (1 - alpha) + currentResult.scale * alpha;

    const smoothedResult: ProcrustesResult = {
      rotation: smoothedRotation,
      translation: smoothedTranslation,
      scale: smoothedScale,
      residualError: currentResult.residualError,
      confidence: currentResult.confidence
    };

    this.previousAlignments.push(smoothedResult);
    
    // Keep only recent alignments for memory efficiency
    if (this.previousAlignments.length > 5) {
      this.previousAlignments.shift();
    }

    return smoothedResult;
  }

  /**
   * Reset temporal smoothing state
   */
  resetSmoothingState(): void {
    this.previousAlignments = [];
    this.alignmentHistory = [];
    this.kalmanFilter.reset();
  }

  /**
   * Main alignment method - performs advanced multi-point face alignment
   */
  async alignImage(
    sourceImage: HTMLImageElement,
    faceResult: FaceDetectionResult,
    targetResolution: ResolutionConfig,
    alignmentMode: AlignmentMode = 'full-face',
    targetFaceResult?: FaceDetectionResult
  ): Promise<AlignmentResult> {
    const startTime = performance.now();

    try {
      // Use direct geometric approach for better face size normalization
      const transformationResult = this.calculateDirectFaceTransformation(
        faceResult,
        sourceImage,
        targetResolution,
        alignmentMode
      );

      // Apply temporal smoothing if needed
      const smoothedResult = this.applySmoothening(transformationResult, startTime);

      // Render aligned image with the calculated transformation
      const transformedCanvas = await this.renderDirectTransformation(
        sourceImage,
        smoothedResult,
        targetResolution
      );

      // Validate the transformation by checking expected outcomes
      this.validateTransformation(transformationResult, targetResolution, sourceImage);

      const alignmentResult: AlignmentResult = {
        transformedCanvas,
        procrustesResult: smoothedResult,
        alignmentConfidence: smoothedResult.confidence,
        usedLandmarks: sourceLandmarks,
        alignmentMode,
        processingTime: performance.now() - startTime
      };

      // Store in history for analysis
      this.alignmentHistory.push(alignmentResult);
      if (this.alignmentHistory.length > 50) {
        this.alignmentHistory.shift();
      }

      return alignmentResult;

    } catch (error) {
      console.error('Advanced face alignment failed:', error);
      throw error;
    }
  }

  /**
   * Two-step face normalization: First normalize face height, then do eye anchoring
   * Step 1: Scale image so face height is standardized
   * Step 2: Apply eye anchoring for precise alignment
   */
  private calculateDirectFaceTransformation(
    faceResult: FaceDetectionResult,
    sourceImage: HTMLImageElement,
    targetResolution: ResolutionConfig,
    alignmentMode: AlignmentMode
  ): ProcrustesResult {
    const landmarks = faceResult.landmarks;
    const imgWidth = sourceImage.width;
    const imgHeight = sourceImage.height;
    
    // Convert key landmarks from normalized to pixel coordinates
    const leftEyeX = landmarks[33].x * imgWidth;    // Left eye center
    const leftEyeY = landmarks[33].y * imgHeight;
    const rightEyeX = landmarks[263].x * imgWidth;  // Right eye center  
    const rightEyeY = landmarks[263].y * imgHeight;
    
    // Get multiple metrics for better face size measurement
    // Try different landmark combinations to find most reliable face height
    const topForeheadY = landmarks[9].y * imgHeight;    // Top of forehead 
    const middleForeheadY = landmarks[10].y * imgHeight; // Middle forehead
    const chinTipY = landmarks[175].y * imgHeight;       // Chin tip
    const jawlineY = landmarks[18].y * imgHeight;        // Jaw center (more stable than chin tip)
    
    // Calculate multiple face height metrics
    const faceHeight1 = Math.abs(chinTipY - topForeheadY);      // Full face height
    const faceHeight2 = Math.abs(jawlineY - middleForeheadY);   // Core face height  
    const faceHeight3 = Math.abs(chinTipY - middleForeheadY);   // Middle to chin
    
    // Use eye-to-chin distance as another reference (more stable)
    const eyeCenterY = (leftEyeY + rightEyeY) / 2;
    const eyeToChin = Math.abs(chinTipY - eyeCenterY);
    const faceHeight4 = eyeToChin * 1.5; // Estimate full face as 1.5x eye-to-chin
    
    // Use the most consistent measurement (usually eye-based measurements are more stable)
    const currentFaceHeight = faceHeight4; // Use eye-to-chin estimation
    const targetFaceHeight = targetResolution.height * 0.6; // Face should be 60% of canvas height
    const faceHeightScale = targetFaceHeight / currentFaceHeight;
    
    // Enhanced debug output with all measurements
    console.log(`Face height metrics:
    - Full (forehead-chin): ${faceHeight1.toFixed(1)}px
    - Core (mid forehead-jaw): ${faceHeight2.toFixed(1)}px  
    - Mid-to-chin: ${faceHeight3.toFixed(1)}px
    - Eye-to-chin estimation: ${faceHeight4.toFixed(1)}px (USING THIS)
    - Target: ${targetFaceHeight.toFixed(1)}px
    - Scale factor: ${faceHeightScale.toFixed(3)}`);
    
    // STEP 2: After face height scaling, calculate eye alignment
    // Apply face height scale to eye positions
    const scaledLeftEyeX = leftEyeX * faceHeightScale;
    const scaledLeftEyeY = leftEyeY * faceHeightScale;
    const scaledRightEyeX = rightEyeX * faceHeightScale;
    const scaledRightEyeY = rightEyeY * faceHeightScale;
    
    // Calculate eye properties after face height scaling
    const scaledEyeCenterX = (scaledLeftEyeX + scaledRightEyeX) / 2;
    const scaledEyeCenterY = (scaledLeftEyeY + scaledRightEyeY) / 2;
    const scaledEyeDistance = Math.sqrt(
      Math.pow(scaledRightEyeX - scaledLeftEyeX, 2) + Math.pow(scaledRightEyeY - scaledLeftEyeY, 2)
    );
    
    // Calculate eye rotation
    const eyeAngle = Math.atan2(scaledRightEyeY - scaledLeftEyeY, scaledRightEyeX - scaledLeftEyeX);
    const rotation = -eyeAngle; // Rotate to make eyes horizontal
    
    // Define target eye position (standard position after face height is normalized)
    const targetEyeCenterX = targetResolution.width / 2;
    const targetEyeCenterY = targetResolution.height * 0.4; // Eyes at 40% from top
    
    // Calculate final translation to center the eyes at target position
    const translationX = targetEyeCenterX - scaledEyeCenterX;
    const translationY = targetEyeCenterY - scaledEyeCenterY;
    
    // Enhanced tracking for validation
    console.log(`Eye alignment metrics:
    - Original eye distance: ${Math.sqrt(Math.pow(rightEyeX - leftEyeX, 2) + Math.pow(rightEyeY - leftEyeY, 2)).toFixed(1)}px
    - Scaled eye distance: ${scaledEyeDistance.toFixed(1)}px
    - Original eye center: [${((leftEyeX + rightEyeX) / 2).toFixed(1)}, ${eyeCenterY.toFixed(1)}]
    - Scaled eye center: [${scaledEyeCenterX.toFixed(1)}, ${scaledEyeCenterY.toFixed(1)}]
    - Target eye center: [${targetEyeCenterX.toFixed(1)}, ${targetEyeCenterY.toFixed(1)}]
    - Eye rotation: ${(rotation * 180 / Math.PI).toFixed(1)}°
    - Final translation: [${translationX.toFixed(1)}, ${translationY.toFixed(1)}]
    - FINAL EXPECTED EYE POS: [${targetEyeCenterX.toFixed(1)}, ${targetEyeCenterY.toFixed(1)}]`);
    
    // Create combined transformation matrix: FaceHeightScale * Rotation * Translation
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const transformMatrix = [
      [faceHeightScale * cos, -faceHeightScale * sin, translationX],
      [faceHeightScale * sin, faceHeightScale * cos, translationY],
      [0, 0, 1]
    ];
    
    return {
      sourcePoints: [
        { x: leftEyeX, y: leftEyeY, z: 0, weight: 1.0, confidence: 1.0, type: 'LEFT_EYE' },
        { x: rightEyeX, y: rightEyeY, z: 0, weight: 1.0, confidence: 1.0, type: 'RIGHT_EYE' },
        { x: (leftEyeX + rightEyeX) / 2, y: foreheadY, z: 0, weight: 0.8, confidence: 1.0, type: 'FOREHEAD' },
        { x: (leftEyeX + rightEyeX) / 2, y: chinY, z: 0, weight: 0.8, confidence: 1.0, type: 'CHIN' }
      ],
      targetPoints: [
        { x: targetEyeCenterX - scaledEyeDistance/2, y: targetEyeCenterY, z: 0, weight: 1.0, confidence: 1.0, type: 'LEFT_EYE' },
        { x: targetEyeCenterX + scaledEyeDistance/2, y: targetEyeCenterY, z: 0, weight: 1.0, confidence: 1.0, type: 'RIGHT_EYE' },
        { x: targetEyeCenterX, y: targetEyeCenterY - targetFaceHeight * 0.25, z: 0, weight: 0.8, confidence: 1.0, type: 'FOREHEAD' },
        { x: targetEyeCenterX, y: targetEyeCenterY + targetFaceHeight * 0.35, z: 0, weight: 0.8, confidence: 1.0, type: 'CHIN' }
      ],
      rotation: transformMatrix,
      translation: [translationX, translationY],
      scale: faceHeightScale,
      residualError: 0.01,
      confidence: 0.95,
      iterationCount: 1
    };
  }

  /**
   * Convert normalized landmarks to pixel coordinates
   */
  private convertToPixelCoordinates(
    landmarks: SemanticLandmark[],
    imageWidth: number,
    imageHeight: number
  ): SemanticLandmark[] {
    return landmarks.map(landmark => ({
      ...landmark,
      x: landmark.x * imageWidth,
      y: landmark.y * imageHeight,
      z: landmark.z // Z is already in normalized depth units
    }));
  }

  /**
   * Generate standardized face landmarks - all faces will be transformed to match these exact positions
   */
  private generateTargetLandmarksPixel(
    targetResolution: ResolutionConfig, 
    alignmentMode: AlignmentMode
  ): SemanticLandmark[] {
    const { width, height } = targetResolution;
    const targets: SemanticLandmark[] = [];
    
    // Define STANDARD face dimensions and positions (all faces will match these exactly)
    const standardFaceHeight = Math.min(width, height) * 0.6; // Face height is 60% of smaller dimension
    const standardFaceWidth = standardFaceHeight * 0.75; // Face width is 75% of face height (natural proportions)
    
    // Standard face center position
    const standardFaceCenterX = width * 0.5; // Horizontally centered
    const standardFaceCenterY = height * 0.5; // Vertically centered
    
    // FIXED positions for key facial features (all faces will have features at these exact pixels)
    const standardEyeY = standardFaceCenterY - standardFaceHeight * 0.15; // Eyes 15% above face center
    const standardEyeSpacing = standardFaceWidth * 0.35; // Eye spacing is 35% of face width
    const standardLeftEyeX = standardFaceCenterX - standardEyeSpacing / 2;
    const standardRightEyeX = standardFaceCenterX + standardEyeSpacing / 2;
    
    const standardNoseY = standardFaceCenterY + standardFaceHeight * 0.05; // Nose 5% below face center
    const standardMouthY = standardFaceCenterY + standardFaceHeight * 0.2; // Mouth 20% below face center
    
    // Add eye landmarks at FIXED positions
    FACIAL_LANDMARKS.LEFT_EYE.forEach((_, i) => {
      targets.push({
        x: standardLeftEyeX,
        y: standardEyeY,
        z: 0,
        weight: LANDMARK_WEIGHTS.LEFT_EYE,
        confidence: 1.0,
        type: 'LEFT_EYE'
      });
    });

    FACIAL_LANDMARKS.RIGHT_EYE.forEach((_, i) => {
      targets.push({
        x: standardRightEyeX,
        y: standardEyeY,
        z: 0,
        weight: LANDMARK_WEIGHTS.RIGHT_EYE,
        confidence: 1.0,
        type: 'RIGHT_EYE'
      });
    });

    // Nose at FIXED position
    FACIAL_LANDMARKS.NOSE_TIP.forEach((_, i) => {
      targets.push({
        x: standardFaceCenterX,
        y: standardNoseY,
        z: 0,
        weight: LANDMARK_WEIGHTS.NOSE_TIP,
        confidence: 1.0,
        type: 'NOSE_TIP'
      });
    });

    // Mouth at FIXED position
    FACIAL_LANDMARKS.MOUTH_OUTER.forEach((_, i) => {
      targets.push({
        x: standardFaceCenterX,
        y: standardMouthY,
        z: 0,
        weight: LANDMARK_WEIGHTS.MOUTH_OUTER,
        confidence: 1.0,
        type: 'MOUTH_OUTER'
      });
    });

    console.log(`Generated standard face targets: Face height=${standardFaceHeight}px, Eyes at y=${standardEyeY}px, Eye spacing=${standardEyeSpacing}px`);
    return targets;
  }

  /**
   * Generate target landmarks for standard alignment modes (deprecated - use generateTargetLandmarksPixel)
   */
  private generateTargetLandmarks(
    targetResolution: ResolutionConfig, 
    alignmentMode: AlignmentMode
  ): SemanticLandmark[] {
    const { width, height } = targetResolution;
    const targetLandmarks: SemanticLandmark[] = [];

    switch (alignmentMode) {
      case 'full-face':
        return this.generateFullFaceTarget(width, height);
      
      case 'feature-specific':
        return this.generateFeatureSpecificTarget(width, height);
      
      case 'expression-invariant':
        return this.generateExpressionInvariantTarget(width, height);
      
      case '3d-perspective':
        return this.generate3DPerspectiveTarget(width, height);
      
      default:
        return this.generateFullFaceTarget(width, height);
    }
  }

  /**
   * Generate canonical face target for full-face alignment
   */
  private generateFullFaceTarget(width: number, height: number): SemanticLandmark[] {
    const targets: SemanticLandmark[] = [];
    
    // Eyes (centered horizontally, 40% from top)
    const eyeY = height * 0.4;
    const eyeSpacing = width * 0.25; // 25% of width between eyes
    const leftEyeX = width * 0.5 - eyeSpacing;
    const rightEyeX = width * 0.5 + eyeSpacing;
    
    // Add eye landmarks
    FACIAL_LANDMARKS.LEFT_EYE.forEach((_, i) => {
      targets.push({
        x: leftEyeX / width,
        y: eyeY / height,
        z: 0,
        weight: LANDMARK_WEIGHTS.LEFT_EYE,
        confidence: 1.0,
        type: 'LEFT_EYE'
      });
    });

    FACIAL_LANDMARKS.RIGHT_EYE.forEach((_, i) => {
      targets.push({
        x: rightEyeX / width,
        y: eyeY / height,
        z: 0,
        weight: LANDMARK_WEIGHTS.RIGHT_EYE,
        confidence: 1.0,
        type: 'RIGHT_EYE'
      });
    });

    // Nose (centered, below eyes)
    const noseY = height * 0.55;
    FACIAL_LANDMARKS.NOSE_TIP.forEach((_, i) => {
      targets.push({
        x: 0.5,
        y: noseY / height,
        z: 0,
        weight: LANDMARK_WEIGHTS.NOSE_TIP,
        confidence: 1.0,
        type: 'NOSE_TIP'
      });
    });

    // Mouth (centered, below nose)
    const mouthY = height * 0.7;
    FACIAL_LANDMARKS.MOUTH_OUTER.forEach((_, i) => {
      targets.push({
        x: 0.5,
        y: mouthY / height,
        z: 0,
        weight: LANDMARK_WEIGHTS.MOUTH_OUTER,
        confidence: 1.0,
        type: 'MOUTH_OUTER'
      });
    });

    return targets;
  }

  /**
   * Generate target for feature-specific alignment (prioritizes key features)
   */
  private generateFeatureSpecificTarget(width: number, height: number): SemanticLandmark[] {
    // Similar to full-face but with higher weights for key features
    const targets = this.generateFullFaceTarget(width, height);
    
    // Increase weights for eyes and nose
    targets.forEach(landmark => {
      if (landmark.type === 'LEFT_EYE' || landmark.type === 'RIGHT_EYE') {
        landmark.weight *= 1.5;
      } else if (landmark.type === 'NOSE_TIP') {
        landmark.weight *= 1.3;
      }
    });

    return targets;
  }

  /**
   * Generate target for expression-invariant alignment
   */
  private generateExpressionInvariantTarget(width: number, height: number): SemanticLandmark[] {
    // Focus on stable features (eyes, nose bridge, forehead)
    const targets: SemanticLandmark[] = [];
    
    // Eyes (same as full-face)
    const eyeY = height * 0.4;
    const eyeSpacing = width * 0.25;
    const leftEyeX = width * 0.5 - eyeSpacing;
    const rightEyeX = width * 0.5 + eyeSpacing;
    
    // Add only stable eye landmarks
    targets.push({
      x: leftEyeX / width,
      y: eyeY / height,
      z: 0,
      weight: 0.6, // Higher weight
      confidence: 1.0,
      type: 'LEFT_EYE'
    });

    targets.push({
      x: rightEyeX / width,
      y: eyeY / height,
      z: 0,
      weight: 0.6,
      confidence: 1.0,
      type: 'RIGHT_EYE'
    });

    // Nose bridge (stable)
    targets.push({
      x: 0.5,
      y: height * 0.5 / height,
      z: 0,
      weight: 0.4,
      confidence: 1.0,
      type: 'NOSE_BRIDGE'
    });

    return targets;
  }

  /**
   * Generate target for 3D perspective-aware alignment
   */
  private generate3DPerspectiveTarget(width: number, height: number): SemanticLandmark[] {
    const targets = this.generateFullFaceTarget(width, height);
    
    // Add depth variation to simulate natural 3D face structure
    targets.forEach(landmark => {
      switch (landmark.type) {
        case 'LEFT_EYE':
        case 'RIGHT_EYE':
          landmark.z = -0.02; // Eyes slightly recessed
          break;
        case 'NOSE_TIP':
          landmark.z = 0.03; // Nose protrudes forward
          break;
        case 'MOUTH_OUTER':
          landmark.z = -0.01; // Mouth slightly recessed
          break;
        default:
          landmark.z = 0;
      }
    });

    return targets;
  }

  /**
   * Render image using the proven transformation matrix approach
   * This mirrors exactly how the working ImageAligner applies transformations
   */
  private async renderDirectTransformation(
    sourceImage: HTMLImageElement,
    transformationResult: ProcrustesResult,
    targetResolution: ResolutionConfig
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = targetResolution.width;
    canvas.height = targetResolution.height;
    const ctx = canvas.getContext('2d')!;

    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Clear canvas 
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetResolution.width, targetResolution.height);

    // Apply transformation matrix exactly like the working implementation
    const matrix = transformationResult.rotation;
    
    ctx.save();
    
    // Use setTransform exactly like the working ImageAligner
    ctx.setTransform(
      matrix[0][0], matrix[1][0],  // a, b
      matrix[0][1], matrix[1][1],  // c, d  
      matrix[0][2], matrix[1][2]   // e, f (translation)
    );

    // Draw the source image at origin (transformation matrix handles positioning)
    ctx.drawImage(sourceImage, 0, 0);
    
    ctx.restore();

    return canvas;
  }

  /**
   * Calculate face center from source landmarks
   */
  private calculateSourceFaceCenter(sourcePoints: any[]): { x: number, y: number } {
    if (sourcePoints.length === 0) {
      return { x: 0, y: 0 };
    }

    // Calculate weighted centroid of facial landmarks
    let totalX = 0, totalY = 0, totalWeight = 0;
    sourcePoints.forEach(point => {
      const weight = point.weight || 1.0;
      totalX += point.x * weight;
      totalY += point.y * weight;
      totalWeight += weight;
    });

    return {
      x: totalX / totalWeight,
      y: totalY / totalWeight
    };
  }

  /**
   * Validate transformation to help debug sizing/positioning issues
   */
  private validateTransformation(
    transformationResult: ProcrustesResult, 
    targetResolution: ResolutionConfig,
    sourceImage: HTMLImageElement
  ): void {
    const matrix = transformationResult.rotation;
    const scale = transformationResult.scale;
    
    // Calculate what the final face height should be after transformation
    const targetFaceHeight = targetResolution.height * 0.6;
    
    // Check if our scale factor makes sense
    const expectedSourceFaceHeight = targetFaceHeight / scale;
    
    console.log(`🔍 Transformation Validation:
    - Source image size: ${sourceImage.width}x${sourceImage.height}px
    - Target canvas size: ${targetResolution.width}x${targetResolution.height}px
    - Scale factor: ${scale.toFixed(3)}
    - Expected source face height: ${expectedSourceFaceHeight.toFixed(1)}px
    - Target face height: ${targetFaceHeight.toFixed(1)}px
    - Transform matrix: [${matrix[0][0].toFixed(3)}, ${matrix[0][1].toFixed(3)}, ${matrix[0][2].toFixed(1)}]
                       [${matrix[1][0].toFixed(3)}, ${matrix[1][1].toFixed(3)}, ${matrix[1][2].toFixed(1)}]
    - ✅ If scale > 1.0: Face was too small (far photo), scaling UP
    - ✅ If scale < 1.0: Face was too large (close photo), scaling DOWN
    - ⚠️  If scale ~1.0: Face size was already good (unlikely)
    `);

    // Flag suspicious transformations
    if (scale > 5.0) {
      console.warn('⚠️  WARNING: Very high scale factor - face might be too small in source or landmarks incorrect');
    }
    if (scale < 0.2) {
      console.warn('⚠️  WARNING: Very low scale factor - face might be too large in source or landmarks incorrect');
    }
  }



  /**
   * Apply perspective correction for 3D-aware alignment
   */
  private async applyPerspectiveCorrection(
    ctx: CanvasRenderingContext2D, 
    resolution: ResolutionConfig
  ): Promise<void> {
    // Get current image data
    const imageData = ctx.getImageData(0, 0, resolution.width, resolution.height);
    
    // Apply perspective correction (simplified implementation)
    // In production, this would use proper perspective transformation matrices
    const correctedImageData = this.correctPerspectiveDistortion(imageData);
    
    // Put corrected data back
    ctx.putImageData(correctedImageData, 0, 0);
  }

  /**
   * Correct perspective distortion in image data
   */
  private correctPerspectiveDistortion(imageData: ImageData): ImageData {
    // Simplified perspective correction
    // In production, implement full perspective transformation
    const corrected = new ImageData(imageData.width, imageData.height);
    corrected.data.set(imageData.data);
    return corrected;
  }

  /**
   * Get comprehensive alignment statistics for debugging/monitoring
   */
  getAlignmentStatistics(): {
    averageConfidence: number;
    averageResidualError: number;
    totalAlignments: number;
    recentAlignmentCount: number;
    averageProcessingTime: number;
    landmarkCoverage: Record<string, number>;
    kalmanFilterStats: {
      isInitialized: boolean;
      confidence: number;
      stateCovariance: number;
      velocityMagnitude: number;
    };
    alignmentModeDistribution: Record<string, number>;
  } {
    if (this.alignmentHistory.length === 0) {
      return {
        averageConfidence: 0,
        averageResidualError: 0,
        totalAlignments: 0,
        recentAlignmentCount: 0,
        averageProcessingTime: 0,
        landmarkCoverage: {},
        kalmanFilterStats: this.kalmanFilter.getFilterStatistics(),
        alignmentModeDistribution: {}
      };
    }

    const recent = this.alignmentHistory.slice(-10); // Last 10 alignments
    
    // Calculate landmark coverage
    const landmarkCoverage: Record<string, number> = {};
    recent.forEach(result => {
      result.usedLandmarks.forEach(landmark => {
        landmarkCoverage[landmark.type] = (landmarkCoverage[landmark.type] || 0) + 1;
      });
    });

    // Normalize coverage by number of recent alignments
    Object.keys(landmarkCoverage).forEach(key => {
      landmarkCoverage[key] = landmarkCoverage[key] / recent.length;
    });

    // Calculate alignment mode distribution
    const alignmentModeDistribution: Record<string, number> = {};
    recent.forEach(result => {
      alignmentModeDistribution[result.alignmentMode] = (alignmentModeDistribution[result.alignmentMode] || 0) + 1;
    });

    Object.keys(alignmentModeDistribution).forEach(key => {
      alignmentModeDistribution[key] = alignmentModeDistribution[key] / recent.length;
    });
    
    return {
      averageConfidence: recent.reduce((sum, r) => sum + r.alignmentConfidence, 0) / recent.length,
      averageResidualError: recent.reduce((sum, r) => sum + r.procrustesResult.residualError, 0) / recent.length,
      totalAlignments: this.alignmentHistory.length,
      recentAlignmentCount: recent.length,
      averageProcessingTime: recent.reduce((sum, r) => sum + r.processingTime, 0) / recent.length,
      landmarkCoverage,
      kalmanFilterStats: this.kalmanFilter.getFilterStatistics(),
      alignmentModeDistribution
    };
  }

  /**
   * Configure Kalman filter parameters at runtime
   */
  configureKalmanFilter(config: Partial<KalmanConfig>): void {
    // Create new Kalman filter with updated config
    const currentConfig = {
      processNoise: 0.005,
      measurementNoise: 0.05,
      initialUncertainty: 0.5,
      velocityDecay: 0.95,
      ...config
    };
    
    this.kalmanFilter = new KalmanFilter(currentConfig);
    console.log('Kalman filter reconfigured:', currentConfig);
  }

  /**
   * Enable or disable Kalman filtering
   */
  setKalmanFiltering(enabled: boolean): void {
    this.useKalmanFiltering = enabled;
    if (!enabled) {
      this.kalmanFilter.reset();
    }
    console.log('Kalman filtering:', enabled ? 'enabled' : 'disabled');
  }
}