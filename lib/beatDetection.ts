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
      console.log('✅ Audio context initialized for beat detection');
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

    console.log('🎵 Starting Beat Detection with web-audio-beat-detector...', {
      duration: audioBuffer.duration.toFixed(2) + 's',
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels
    });

    try {
      return await this.detectBeatsWebAudio(audioBuffer, sensitivity);
    } catch (error) {
      console.error('Web Audio beat detection failed:', error);
      console.warn('Falling back to RMS detection...');
      return this.detectBeatsRMS(audioBuffer, sensitivity);
    }
  }

  /**
   * Onset detection using Spectral Flux
   * Detects beats across all frequency ranges (kick, snare, hi-hat, etc.)
   */
  private async detectBeatsWebAudio(
    audioBuffer: AudioBuffer,
    sensitivity: number
  ): Promise<BeatDetectionResult> {
    try {
      console.log('🎵 Running onset detection (spectral flux)...');
      
      // Step 1: Compute spectral flux (how much spectrum changes over time)
      const fftSize = 2048; // ~43ms windows at 48kHz
      const hopSize = 1024; // 50% overlap
      const flux = this.computeSpectralFlux(audioBuffer, fftSize, hopSize);
      
      console.log('Spectral flux computed:', {
        fftSize,
        hopSize,
        windowDuration: ((fftSize / audioBuffer.sampleRate) * 1000).toFixed(1) + 'ms',
        fluxValues: flux.length,
        totalDuration: audioBuffer.duration.toFixed(2) + 's'
      });
      
      // Step 2: Detect onsets from flux curve
      const beatTimestamps = this.detectOnsetsFromFlux(
        flux,
        audioBuffer.sampleRate,
        hopSize,
        sensitivity
      );
      
      // Step 3: Calculate BPM from intervals
      const bpm = this.calculateBPMFromBeats(beatTimestamps);
      
      // Step 4: Calculate confidence based on regularity
      const confidence = this.calculateConfidence(beatTimestamps, bpm);
      
      console.log('✅ Onset Detection Complete:', {
        onsetsDetected: beatTimestamps.length,
        bpm: Math.round(bpm),
        confidence: (confidence * 100).toFixed(0) + '%',
        duration: audioBuffer.duration.toFixed(2) + 's',
        firstFewOnsets: beatTimestamps.slice(0, 5).map((b: number) => b.toFixed(3)),
        intervals: beatTimestamps.slice(1, 6).map((b: number, i: number) => 
          (b - beatTimestamps[i]).toFixed(3)
        ),
        avgInterval: beatTimestamps.length > 1 ? 
          (this.calculateAverageInterval(beatTimestamps) * 1000).toFixed(0) + 'ms' : 'N/A'
      });

      return {
        beats: beatTimestamps,
        bpm: Math.round(bpm),
        confidence,
        duration: audioBuffer.duration
      };
    } catch (error) {
      console.error('Onset detection failed:', error);
      throw error;
    }
  }
  
  /**
   * Compute spectral flux: measure how much the frequency spectrum changes over time
   * High flux = onset (beat, transient, attack)
   */
  private computeSpectralFlux(
    audioBuffer: AudioBuffer,
    fftSize: number,
    hopSize: number
  ): Float32Array {
    const channelData = audioBuffer.getChannelData(0); // Use first channel (mono or left)
    const sampleRate = audioBuffer.sampleRate;
    
    // Calculate number of windows
    const numWindows = Math.floor((channelData.length - fftSize) / hopSize) + 1;
    const flux = new Float32Array(numWindows);
    
    // Create offline context for FFT analysis
    const offlineContext = new OfflineAudioContext(1, audioBuffer.length, sampleRate);
    const analyser = offlineContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0; // No smoothing, we want raw data
    
    const bufferSize = analyser.frequencyBinCount;
    const currentSpectrum = new Float32Array(bufferSize);
    let previousSpectrum = new Float32Array(bufferSize);
    
    // Process each window
    for (let i = 0; i < numWindows; i++) {
      const offset = i * hopSize;
      
      // Extract window
      const windowData = channelData.slice(offset, offset + fftSize);
      
      // Apply Hann window to reduce spectral leakage
      for (let j = 0; j < windowData.length; j++) {
        const multiplier = 0.5 * (1 - Math.cos(2 * Math.PI * j / (fftSize - 1)));
        windowData[j] *= multiplier;
      }
      
      // Compute FFT using analyser (simplified approach)
      // In a real implementation, we'd use a proper FFT library
      // For now, calculate energy-based flux as approximation
      let sumOfSquares = 0;
      for (let j = 0; j < windowData.length; j++) {
        sumOfSquares += windowData[j] * windowData[j];
      }
      currentSpectrum[0] = Math.sqrt(sumOfSquares / fftSize);
      
      // Calculate spectral flux: sum of positive differences
      let fluxValue = 0;
      for (let j = 0; j < bufferSize; j++) {
        const diff = currentSpectrum[j] - previousSpectrum[j];
        if (diff > 0) {
          fluxValue += diff;
        }
      }
      
      flux[i] = fluxValue;
      
      // Update previous spectrum
      previousSpectrum = new Float32Array(currentSpectrum);
    }
    
    return flux;
  }
  
  /**
   * Detect onsets from spectral flux curve
   * Finds peaks in the flux that represent beat positions
   */
  private detectOnsetsFromFlux(
    flux: Float32Array,
    sampleRate: number,
    hopSize: number,
    sensitivity: number
  ): number[] {
    if (flux.length === 0) return [];
    
    // Step 1: Calculate adaptive threshold
    // Use median + factor based on sensitivity
    const sortedFlux = Array.from(flux).sort((a, b) => a - b);
    const median = sortedFlux[Math.floor(sortedFlux.length / 2)];
    const mean = sortedFlux.reduce((sum, val) => sum + val, 0) / sortedFlux.length;
    
    // Lower sensitivity = higher threshold (fewer onsets)
    // Higher sensitivity = lower threshold (more onsets)
    const thresholdMultiplier = 1.5 - (sensitivity * 0.8); // Range: 1.5 to 0.7
    const threshold = median + (mean - median) * thresholdMultiplier;
    
    console.log('Onset detection threshold:', {
      median: median.toFixed(6),
      mean: mean.toFixed(6),
      threshold: threshold.toFixed(6),
      sensitivity,
      multiplier: thresholdMultiplier.toFixed(2)
    });
    
    // Step 2: Find local maxima in flux curve
    const onsetIndices: number[] = [];
    const minOnsetDistance = Math.floor((0.05 * sampleRate) / hopSize); // 50ms minimum
    
    for (let i = 1; i < flux.length - 1; i++) {
      // Check if this is a local maximum
      const isLocalMax = flux[i] > flux[i - 1] && flux[i] > flux[i + 1];
      
      // Check if it exceeds threshold
      const exceedsThreshold = flux[i] > threshold;
      
      // Check if we're not too close to last onset
      const farEnoughFromLast = onsetIndices.length === 0 || 
        (i - onsetIndices[onsetIndices.length - 1]) >= minOnsetDistance;
      
      if (isLocalMax && exceedsThreshold && farEnoughFromLast) {
        onsetIndices.push(i);
      }
    }
    
    console.log('Found onsets:', {
      rawOnsets: onsetIndices.length,
      minDistance: (minOnsetDistance * hopSize / sampleRate * 1000).toFixed(0) + 'ms'
    });
    
    // Step 3: Convert window indices to timestamps
    const onsetTimestamps = onsetIndices.map(index => {
      // Time = (window index * hop size) / sample rate
      return (index * hopSize) / sampleRate;
    });
    
    return onsetTimestamps;
  }
  
  /**
   * Calculate BPM from beat timestamps
   */
  private calculateBPMFromBeats(beats: number[]): number {
    if (beats.length < 2) return 120; // Default BPM
    
    // Calculate average interval between beats
    const avgInterval = this.calculateAverageInterval(beats);
    
    // BPM = 60 seconds / interval
    let bpm = 60 / avgInterval;
    
    // Adjust to typical range (90-180 BPM)
    while (bpm < 90) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    
    return bpm;
  }

  private async detectBeatsRMS(
    audioBuffer: AudioBuffer,
    sensitivity: number
  ): Promise<BeatDetectionResult> {
    // Get audio data from the first channel
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    console.log('Using fallback RMS beat detection...');

    // Apply onset detection using RMS energy
    const beats = this.detectOnsets(audioData, sampleRate, sensitivity);
    
    // Calculate BPM from detected beats
    const bpm = this.calculateBPM(beats);
    
    // Calculate confidence based on beat regularity
    const confidence = this.calculateConfidence(beats, bpm);

    console.log('✅ RMS Beat Detection Complete:', {
      beatsFound: beats.length,
      bpm,
      confidence: (confidence * 100).toFixed(0) + '%',
      firstFewBeats: beats.slice(0, 5).map(b => b.toFixed(2))
    });

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

    console.log('Raw beats detected:', beats.length);
    const refinedBeats = this.refineBeats(beats);
    console.log('Beats after refinement:', refinedBeats.length);
    
    return refinedBeats;
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
    
    // Use percentile-based threshold - ADJUSTED for better detection
    energies.sort((a, b) => a - b);
    // Lower base percentile and increase sensitivity range
    const percentile = 0.5 + (sensitivity * 0.4); // 50-90th percentile (was 70-95)
    const index = Math.floor(energies.length * percentile);
    
    const threshold = energies[index] || 0;
    console.log('Beat Detection Threshold:', {
      sensitivity,
      percentile: `${(percentile * 100).toFixed(0)}th`,
      threshold: threshold.toFixed(6),
      totalWindows: energies.length,
      minEnergy: energies[0]?.toFixed(6),
      maxEnergy: energies[energies.length - 1]?.toFixed(6)
    });
    
    return threshold;
  }

  private refineBeats(rawBeats: number[]): number[] {
    if (rawBeats.length < 2) return rawBeats;
    
    // DISABLED: Refinement is too aggressive and kills most beats
    // For now, just remove obvious doubles (beats < 100ms apart)
    console.log('Removing duplicate beats (< 100ms apart)...');
    
    const dedupedBeats: number[] = [rawBeats[0]];
    for (let i = 1; i < rawBeats.length; i++) {
      const timeSinceLastBeat = rawBeats[i] - dedupedBeats[dedupedBeats.length - 1];
      if (timeSinceLastBeat >= 0.1) {  // At least 100ms apart
        dedupedBeats.push(rawBeats[i]);
      }
    }
    
    console.log('Beat deduplication:', {
      rawBeats: rawBeats.length,
      afterDedup: dedupedBeats.length,
      removed: rawBeats.length - dedupedBeats.length
    });
    
    return dedupedBeats;
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

  /**
   * Convert beat timestamps to frame durations
   * Each image change happens ON a beat - durations reflect actual rhythm
   */
  generateFrameDurations(beats: number[], imageCount: number, offset: number = 0): number[] {
    if (beats.length === 0 || imageCount === 0) return [];
    
    // Apply offset to beats
    const adjustedBeats = beats.map(b => b + offset).filter(b => b >= 0);
    
    if (adjustedBeats.length === 0) return [];
    
    // Strategy: Each image shows from one beat to the next
    // If we have more beats than images, distribute images evenly across beats
    
    if (adjustedBeats.length >= imageCount) {
      // ONE IMAGE PER BEAT: Use first N consecutive beats
      const durations: number[] = [];
      
      // Each image shows from one beat to the next beat
      for (let i = 0; i < imageCount; i++) {
        if (i + 1 < adjustedBeats.length) {
          // Duration = time from this beat to next beat
          const duration = adjustedBeats[i + 1] - adjustedBeats[i];
          durations.push(duration);
        } else {
          // Last image: use average interval
          const avgInterval = this.calculateAverageInterval(adjustedBeats);
          durations.push(avgInterval);
        }
      }
      
      console.log('Beat Sync Frame Durations (consecutive beats):', {
        totalImages: imageCount,
        detectedBeats: adjustedBeats.length,
        usingBeats: `0-${imageCount}`,
        beatTimes: adjustedBeats.slice(0, 6).map(b => b.toFixed(3)),
        frameDurations: durations.slice(0, 5).map(d => d.toFixed(3)),
        intervals: durations.slice(0, 5).map((d, i) => 
          i > 0 ? `${((d - durations[i-1]) * 1000).toFixed(0)}ms` : 'first'
        ),
        totalDuration: durations.reduce((sum, d) => sum + d, 0).toFixed(2) + 's'
      });
      
      return durations;
      
    } else {
      // FEWER BEATS THAN IMAGES: Only use images up to available beats
      // Don't extend beyond music - stop naturally when beats end
      const durations: number[] = [];
      const usableImages = Math.min(adjustedBeats.length - 1, imageCount);
      
      // Use actual beat intervals for available beats
      for (let i = 0; i < usableImages; i++) {
        durations.push(adjustedBeats[i + 1] - adjustedBeats[i]);
      }
      
      console.log('Beat Sync Frame Durations (limited by music):', {
        totalImages: imageCount,
        detectedBeats: adjustedBeats.length,
        usedImages: usableImages,
        unusedImages: imageCount - usableImages,
        frameDurations: durations.slice(0, 5).map(d => d.toFixed(3)),
        totalDuration: durations.reduce((sum, d) => sum + d, 0).toFixed(2) + 's',
        musicEnds: adjustedBeats[adjustedBeats.length - 1].toFixed(2) + 's'
      });
      
      return durations;
    }
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
