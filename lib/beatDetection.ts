export interface BeatDetectionResult {
  beats: number[]; // Array of beat timestamps in seconds
  bpm: number; // Detected BPM
  confidence: number; // Detection confidence (0-1)
  duration: number; // Audio duration in seconds
}

export interface BeatSyncSettings {
  enabled: boolean;
  musicFile?: File;
  beatSensitivity: number; // 0.1 to 1.0
  syncMode: 'auto' | 'manual';
  manualBpm?: number;
  beatOffset: number; // Offset in seconds to align first beat
}

export class BeatDetector {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Failed to initialize audio context for beat detection:', error);
    }
  }

  async loadAudioFile(file: File): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return this.audioBuffer;
    } catch (error) {
      console.error('Failed to load audio file:', error);
      throw new Error('Failed to load audio file. Please ensure it\'s a valid audio format.');
    }
  }

  async detectBeats(
    audioBuffer: AudioBuffer, 
    sensitivity: number = 0.5
  ): Promise<BeatDetectionResult> {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    // Get audio data from the first channel
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Apply onset detection using spectral flux
    const beats = this.detectOnsets(audioData, sampleRate, sensitivity);
    
    // Calculate BPM from detected beats
    const bpm = this.calculateBPM(beats);
    
    // Calculate confidence based on beat regularity
    const confidence = this.calculateConfidence(beats, bpm);

    return {
      beats,
      bpm,
      confidence,
      duration
    };
  }

  private detectOnsets(audioData: Float32Array, sampleRate: number, sensitivity: number): number[] {
    const windowSize = 1024;
    const hopSize = 512;
    const beats: number[] = [];
    
    // Simple onset detection using energy-based method
    const energyThreshold = this.calculateEnergyThreshold(audioData, sensitivity);
    
    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
      const window = audioData.slice(i, i + windowSize);
      const energy = this.calculateRMSEnergy(window);
      
      // Look for energy peaks that exceed threshold
      if (energy > energyThreshold) {
        const timeStamp = i / sampleRate;
        
        // Avoid beats too close together (minimum 100ms apart)
        if (beats.length === 0 || timeStamp - beats[beats.length - 1] > 0.1) {
          beats.push(timeStamp);
        }
      }
    }

    return this.refineBeats(beats);
  }

  private calculateRMSEnergy(window: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < window.length; i++) {
      sum += window[i] * window[i];
    }
    return Math.sqrt(sum / window.length);
  }

  private calculateEnergyThreshold(audioData: Float32Array, sensitivity: number): number {
    const windowSize = 1024;
    const hopSize = 512;
    const energies: number[] = [];
    
    // Calculate energy for all windows
    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
      const window = audioData.slice(i, i + windowSize);
      energies.push(this.calculateRMSEnergy(window));
    }
    
    // Use percentile-based threshold
    energies.sort((a, b) => a - b);
    const percentile = 0.7 + (sensitivity * 0.25); // 70-95th percentile
    const index = Math.floor(energies.length * percentile);
    
    return energies[index] || 0;
  }

  private refineBeats(rawBeats: number[]): number[] {
    if (rawBeats.length < 2) return rawBeats;

    // Remove outliers and smooth beat positions
    const intervals = [];
    for (let i = 1; i < rawBeats.length; i++) {
      intervals.push(rawBeats[i] - rawBeats[i - 1]);
    }

    // Find median interval
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    // Filter beats that are too far from expected positions
    const refinedBeats = [rawBeats[0]];
    for (let i = 1; i < rawBeats.length; i++) {
      const expectedTime = refinedBeats[refinedBeats.length - 1] + medianInterval;
      const actualTime = rawBeats[i];
      
      // Allow 20% deviation from expected timing
      if (Math.abs(actualTime - expectedTime) < medianInterval * 0.2) {
        refinedBeats.push(actualTime);
      }
    }

    return refinedBeats;
  }

  private calculateBPM(beats: number[]): number {
    if (beats.length < 2) return 120; // Default BPM

    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }

    // Calculate average interval
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Convert to BPM
    return Math.round(60 / avgInterval);
  }

  private calculateConfidence(beats: number[], bpm: number): number {
    if (beats.length < 4) return 0.3;

    const expectedInterval = 60 / bpm;
    let deviations = 0;
    
    for (let i = 1; i < beats.length; i++) {
      const actualInterval = beats[i] - beats[i - 1];
      const deviation = Math.abs(actualInterval - expectedInterval) / expectedInterval;
      deviations += deviation;
    }

    const avgDeviation = deviations / (beats.length - 1);
    
    // Convert deviation to confidence (lower deviation = higher confidence)
    return Math.max(0, Math.min(1, 1 - avgDeviation * 2));
  }

  // Generate beat-synced frame timings for given number of images
  generateFrameTimings(beats: number[], imageCount: number, offset: number = 0): number[] {
    if (beats.length === 0 || imageCount === 0) return [];

    const adjustedBeats = beats.map(beat => beat + offset).filter(beat => beat >= 0);
    
    if (adjustedBeats.length === 0) return [];

    // If we have more beats than images, use the first N beats
    if (adjustedBeats.length >= imageCount) {
      return adjustedBeats.slice(0, imageCount);
    }

    // If we have fewer beats than images, extrapolate based on BPM
    const frameTimes = [...adjustedBeats];
    const avgInterval = this.calculateAverageInterval(adjustedBeats);
    
    // Extend forward to reach required image count
    let lastTime = adjustedBeats[adjustedBeats.length - 1];
    while (frameTimes.length < imageCount) {
      lastTime += avgInterval;
      frameTimes.push(lastTime);
    }

    return frameTimes.slice(0, imageCount);
  }

  private calculateAverageInterval(beats: number[]): number {
    if (beats.length < 2) return 0.5; // Default 0.5s interval

    let totalInterval = 0;
    for (let i = 1; i < beats.length; i++) {
      totalInterval += beats[i] - beats[i - 1];
    }

    return totalInterval / (beats.length - 1);
  }

  // Calculate total duration needed for all images with beat sync
  calculateSyncedDuration(beats: number[], imageCount: number, offset: number = 0): number {
    const frameTimings = this.generateFrameTimings(beats, imageCount, offset);
    if (frameTimings.length === 0) return 0;

    // Add a small buffer after the last frame
    return frameTimings[frameTimings.length - 1] + 0.1;
  }

  cleanup(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioBuffer = null;
  }
}
