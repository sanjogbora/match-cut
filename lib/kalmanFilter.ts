/**
 * Kalman Filter implementation for temporal smoothing of face alignment parameters
 * Reduces jitter and provides optimal state estimation for smooth match cut transitions
 */

export interface KalmanState {
  // State vector: [x, y, z, rotation, scale, vx, vy, vz, vr, vs]
  x: number[];      // State estimate
  P: number[][];    // Error covariance matrix
  F: number[][];    // State transition matrix
  H: number[][];    // Observation matrix
  Q: number[][];    // Process noise covariance
  R: number[][];    // Measurement noise covariance
  K: number[][];    // Kalman gain
}

export interface KalmanConfig {
  processNoise: number;           // Process noise variance
  measurementNoise: number;       // Measurement noise variance
  initialUncertainty: number;     // Initial state uncertainty
  velocityDecay: number;          // Velocity decay factor (0-1)
}

export class KalmanFilter {
  private state: KalmanState;
  private config: KalmanConfig;
  private initialized: boolean = false;
  private lastTimestamp: number = 0;

  constructor(config: KalmanConfig = {
    processNoise: 0.01,
    measurementNoise: 0.1,
    initialUncertainty: 1.0,
    velocityDecay: 0.9
  }) {
    this.config = config;
    this.state = this.initializeState();
  }

  /**
   * Initialize Kalman filter state matrices
   */
  private initializeState(): KalmanState {
    const stateSize = 10; // [x, y, z, rotation, scale, vx, vy, vz, vr, vs]
    const observationSize = 5; // [x, y, z, rotation, scale]

    // Initial state estimate (all zeros)
    const x = new Array(stateSize).fill(0);
    x[4] = 1.0; // Initialize scale to 1

    // Initial error covariance (high uncertainty)
    const P = this.createIdentityMatrix(stateSize).map(row => 
      row.map(val => val * this.config.initialUncertainty)
    );

    // State transition matrix (constant velocity model)
    const F = this.createStateTransitionMatrix(stateSize);

    // Observation matrix (only observe position, rotation, scale)
    const H = this.createObservationMatrix(observationSize, stateSize);

    // Process noise covariance
    const Q = this.createProcessNoiseMatrix(stateSize);

    // Measurement noise covariance
    const R = this.createMeasurementNoiseMatrix(observationSize);

    // Kalman gain (will be computed during update)
    const K = this.createZeroMatrix(stateSize, observationSize);

    return { x, P, F, H, Q, R, K };
  }

  /**
   * Create identity matrix
   */
  private createIdentityMatrix(size: number): number[][] {
    const matrix = this.createZeroMatrix(size, size);
    for (let i = 0; i < size; i++) {
      matrix[i][i] = 1.0;
    }
    return matrix;
  }

  /**
   * Create zero matrix
   */
  private createZeroMatrix(rows: number, cols: number): number[][] {
    return Array(rows).fill(null).map(() => Array(cols).fill(0));
  }

  /**
   * Create state transition matrix for constant velocity model
   */
  private createStateTransitionMatrix(stateSize: number): number[][] {
    const F = this.createIdentityMatrix(stateSize);
    const dt = 1.0; // Assume unit time step

    // Position updates: x(k+1) = x(k) + dt * vx(k)
    F[0][5] = dt; // x += vx
    F[1][6] = dt; // y += vy  
    F[2][7] = dt; // z += vz
    F[3][8] = dt; // rotation += v_rotation
    F[4][9] = dt; // scale += v_scale

    // Velocity decay
    F[5][5] = this.config.velocityDecay; // vx decay
    F[6][6] = this.config.velocityDecay; // vy decay
    F[7][7] = this.config.velocityDecay; // vz decay
    F[8][8] = this.config.velocityDecay; // v_rotation decay
    F[9][9] = this.config.velocityDecay; // v_scale decay

    return F;
  }

  /**
   * Create observation matrix
   */
  private createObservationMatrix(obsSize: number, stateSize: number): number[][] {
    const H = this.createZeroMatrix(obsSize, stateSize);
    
    // Observe position, rotation, and scale directly
    H[0][0] = 1.0; // observe x
    H[1][1] = 1.0; // observe y
    H[2][2] = 1.0; // observe z
    H[3][3] = 1.0; // observe rotation
    H[4][4] = 1.0; // observe scale

    return H;
  }

  /**
   * Create process noise covariance matrix
   */
  private createProcessNoiseMatrix(stateSize: number): number[][] {
    const Q = this.createZeroMatrix(stateSize, stateSize);
    const dt = 1.0;
    const processVar = this.config.processNoise;

    // Position noise (from velocity uncertainty)
    Q[0][0] = processVar * dt * dt; // x
    Q[1][1] = processVar * dt * dt; // y
    Q[2][2] = processVar * dt * dt; // z
    Q[3][3] = processVar * dt * dt; // rotation
    Q[4][4] = processVar * dt * dt; // scale

    // Velocity noise
    Q[5][5] = processVar; // vx
    Q[6][6] = processVar; // vy
    Q[7][7] = processVar; // vz
    Q[8][8] = processVar; // v_rotation
    Q[9][9] = processVar; // v_scale

    return Q;
  }

  /**
   * Create measurement noise covariance matrix
   */
  private createMeasurementNoiseMatrix(obsSize: number): number[][] {
    const R = this.createZeroMatrix(obsSize, obsSize);
    const measureVar = this.config.measurementNoise;

    // Measurement noise for observed variables
    R[0][0] = measureVar;     // x measurement noise
    R[1][1] = measureVar;     // y measurement noise
    R[2][2] = measureVar;     // z measurement noise
    R[3][3] = measureVar;     // rotation measurement noise
    R[4][4] = measureVar;     // scale measurement noise

    return R;
  }

  /**
   * Predict step of Kalman filter
   */
  private predict(): void {
    const { x, P, F, Q } = this.state;

    // Predict state: x = F * x
    const x_pred = this.matrixVectorMultiply(F, x);

    // Predict covariance: P = F * P * F' + Q
    const FP = this.matrixMultiply(F, P);
    const FPFt = this.matrixMultiply(FP, this.transpose(F));
    const P_pred = this.matrixAdd(FPFt, Q);

    this.state.x = x_pred;
    this.state.P = P_pred;
  }

  /**
   * Update step of Kalman filter
   */
  private update(measurement: number[]): void {
    const { x, P, H, R } = this.state;

    // Innovation: y = z - H * x
    const Hx = this.matrixVectorMultiply(H, x);
    const innovation = this.vectorSubtract(measurement, Hx);

    // Innovation covariance: S = H * P * H' + R
    const HP = this.matrixMultiply(H, P);
    const HPHt = this.matrixMultiply(HP, this.transpose(H));
    const S = this.matrixAdd(HPHt, R);

    // Kalman gain: K = P * H' * S^(-1)
    const PHt = this.matrixMultiply(P, this.transpose(H));
    const S_inv = this.matrixInverse(S);
    const K = this.matrixMultiply(PHt, S_inv);

    // Update state: x = x + K * y
    const Ky = this.matrixVectorMultiply(K, innovation);
    const x_updated = this.vectorAdd(x, Ky);

    // Update covariance: P = (I - K * H) * P
    const KH = this.matrixMultiply(K, H);
    const I = this.createIdentityMatrix(x.length);
    const I_KH = this.matrixSubtract(I, KH);
    const P_updated = this.matrixMultiply(I_KH, P);

    this.state.x = x_updated;
    this.state.P = P_updated;
    this.state.K = K;
  }

  /**
   * Apply Kalman filtering to alignment parameters
   */
  filterAlignment(
    translation: [number, number, number],
    rotation: number, // Single rotation angle
    scale: number,
    timestamp?: number
  ): {
    translation: [number, number, number];
    rotation: number;
    scale: number;
    confidence: number;
  } {
    // Update time step if provided
    if (timestamp && this.lastTimestamp > 0) {
      const dt = (timestamp - this.lastTimestamp) / 1000; // Convert to seconds
      this.updateTimeStep(dt);
    }
    this.lastTimestamp = timestamp || performance.now();

    // Create measurement vector
    const measurement = [
      translation[0],
      translation[1], 
      translation[2],
      rotation,
      scale
    ];

    if (!this.initialized) {
      // Initialize state with first measurement
      this.state.x[0] = translation[0];
      this.state.x[1] = translation[1];
      this.state.x[2] = translation[2];
      this.state.x[3] = rotation;
      this.state.x[4] = scale;
      this.initialized = true;
      
      return {
        translation,
        rotation,
        scale,
        confidence: 0.5 // Low confidence for first measurement
      };
    }

    // Kalman filter predict and update steps
    this.predict();
    this.update(measurement);

    // Extract filtered values
    const filteredTranslation: [number, number, number] = [
      this.state.x[0],
      this.state.x[1],
      this.state.x[2]
    ];
    const filteredRotation = this.state.x[3];
    const filteredScale = this.state.x[4];

    // Calculate confidence based on covariance trace
    const confidence = this.calculateConfidence();

    return {
      translation: filteredTranslation,
      rotation: filteredRotation,
      scale: filteredScale,
      confidence
    };
  }

  /**
   * Update time step in state transition matrix
   */
  private updateTimeStep(dt: number): void {
    // Update state transition matrix with new dt
    this.state.F[0][5] = dt; // x += dt * vx
    this.state.F[1][6] = dt; // y += dt * vy  
    this.state.F[2][7] = dt; // z += dt * vz
    this.state.F[3][8] = dt; // rotation += dt * v_rotation
    this.state.F[4][9] = dt; // scale += dt * v_scale
  }

  /**
   * Calculate confidence based on state covariance
   */
  private calculateConfidence(): number {
    const P = this.state.P;
    
    // Calculate trace of position and orientation covariance
    const positionVar = P[0][0] + P[1][1] + P[2][2];
    const orientationVar = P[3][3];
    const scaleVar = P[4][4];
    
    // Lower variance = higher confidence
    const totalVar = positionVar + orientationVar + scaleVar;
    const maxVar = 1.0; // Assume maximum reasonable variance
    
    return Math.max(0.1, Math.min(1.0, 1.0 - totalVar / maxVar));
  }

  /**
   * Reset Kalman filter state
   */
  reset(): void {
    this.state = this.initializeState();
    this.initialized = false;
    this.lastTimestamp = 0;
  }

  /**
   * Matrix operations
   */
  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    const result = this.createZeroMatrix(A.length, B[0].length);
    
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < B[0].length; j++) {
        for (let k = 0; k < B.length; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    
    return result;
  }

  private matrixVectorMultiply(A: number[][], v: number[]): number[] {
    const result = new Array(A.length).fill(0);
    
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < v.length; j++) {
        result[i] += A[i][j] * v[j];
      }
    }
    
    return result;
  }

  private matrixAdd(A: number[][], B: number[][]): number[][] {
    const result = this.createZeroMatrix(A.length, A[0].length);
    
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < A[0].length; j++) {
        result[i][j] = A[i][j] + B[i][j];
      }
    }
    
    return result;
  }

  private matrixSubtract(A: number[][], B: number[][]): number[][] {
    const result = this.createZeroMatrix(A.length, A[0].length);
    
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < A[0].length; j++) {
        result[i][j] = A[i][j] - B[i][j];
      }
    }
    
    return result;
  }

  private vectorAdd(a: number[], b: number[]): number[] {
    return a.map((val, i) => val + b[i]);
  }

  private vectorSubtract(a: number[], b: number[]): number[] {
    return a.map((val, i) => val - b[i]);
  }

  private transpose(A: number[][]): number[][] {
    const result = this.createZeroMatrix(A[0].length, A.length);
    
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < A[0].length; j++) {
        result[j][i] = A[i][j];
      }
    }
    
    return result;
  }

  private matrixInverse(A: number[][]): number[][] {
    // Simplified matrix inversion for small matrices (2x2, 3x3)
    const n = A.length;
    
    if (n === 1) {
      return [[1 / A[0][0]]];
    }
    
    if (n === 2) {
      const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
      if (Math.abs(det) < 1e-10) {
        // Singular matrix - return identity
        return this.createIdentityMatrix(n);
      }
      return [
        [A[1][1] / det, -A[0][1] / det],
        [-A[1][0] / det, A[0][0] / det]
      ];
    }
    
    // For larger matrices, use Gauss-Jordan elimination
    return this.gaussJordanInverse(A);
  }

  private gaussJordanInverse(A: number[][]): number[][] {
    const n = A.length;
    const augmented = A.map((row, i) => {
      const newRow = [...row];
      for (let j = 0; j < n; j++) {
        newRow.push(i === j ? 1 : 0);
      }
      return newRow;
    });

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Check for singular matrix
      if (Math.abs(augmented[i][i]) < 1e-10) {
        console.warn('Singular matrix detected, returning identity');
        return this.createIdentityMatrix(n);
      }

      // Scale pivot row
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // Extract inverse matrix
    const inverse = augmented.map(row => row.slice(n));
    return inverse;
  }

  /**
   * Get current filter statistics
   */
  getFilterStatistics(): {
    isInitialized: boolean;
    confidence: number;
    stateCovariance: number;
    velocityMagnitude: number;
  } {
    if (!this.initialized) {
      return {
        isInitialized: false,
        confidence: 0,
        stateCovariance: 0,
        velocityMagnitude: 0
      };
    }

    const velocityMagnitude = Math.sqrt(
      this.state.x[5] ** 2 + // vx
      this.state.x[6] ** 2 + // vy
      this.state.x[7] ** 2   // vz
    );

    const stateCovariance = this.state.P.reduce((sum, row, i) => sum + row[i], 0) / this.state.P.length;

    return {
      isInitialized: this.initialized,
      confidence: this.calculateConfidence(),
      stateCovariance,
      velocityMagnitude
    };
  }
}