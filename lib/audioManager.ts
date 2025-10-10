import { AudioSettings } from './types';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    } catch (error) {
      console.warn('Failed to initialize audio context:', error);
    }
  }

  async loadBuiltinSound(soundType: 'click' | 'shutter' | 'pop'): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    const soundFiles = {
      click: '/click-sound.mp3',
      shutter: '/shutter-sound.mp3', // You can add this later
      pop: '/pop-sound.mp3' // You can add this later
    };

    const soundUrl = soundFiles[soundType];
    if (this.audioBuffers.has(soundType)) {
      return this.audioBuffers.get(soundType)!;
    }

    try {
      const response = await fetch(soundUrl);
      if (!response.ok) {
        console.warn(`Sound file not found: ${soundUrl}`);
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(soundType, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`Failed to load sound ${soundType}:`, error);
      return null;
    }
  }

  async loadCustomSound(file: File): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioBuffers.set('custom', audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('Failed to load custom audio:', error);
      return null;
    }
  }

  playSound(audioSettings: AudioSettings, syncMode: 'immediate' | 'scheduled' = 'immediate', when: number = 0): void {
    if (!this.audioContext || !this.gainNode || !audioSettings.enabled) return;

    const bufferKey = audioSettings.type === 'custom' ? 'custom' : audioSettings.builtinSound;
    const audioBuffer = this.audioBuffers.get(bufferKey);
    
    if (!audioBuffer) {
      console.warn(`Audio buffer not found for: ${bufferKey}`);
      return;
    }

    // Stop any currently playing sound
    if (this.currentSource) {
      this.currentSource.stop();
    }

    // Create new source
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = audioBuffer;
    
    // Set volume
    this.gainNode.gain.value = audioSettings.volume;
    
    // Connect and play
    this.currentSource.connect(this.gainNode);
    
    if (syncMode === 'scheduled' && when > 0) {
      this.currentSource.start(when);
    } else {
      this.currentSource.start();
    }
  }

  // Create synchronized audio track for video export
  async createSynchronizedAudioTrack(
    audioSettings: AudioSettings,
    frameDurations: number[],
    syncMode: 'frame-start' | 'frame-center' = 'frame-start'
  ): Promise<AudioBuffer | null> {
    if (!this.audioContext || !audioSettings.enabled) return null;

    const bufferKey = audioSettings.type === 'custom' ? 'custom' : audioSettings.builtinSound;
    const sourceBuffer = this.audioBuffers.get(bufferKey);
    
    if (!sourceBuffer) {
      console.warn(`Audio buffer not found for synchronized track: ${bufferKey}`);
      return null;
    }

    // Calculate total duration and timing
    const totalDuration = frameDurations.reduce((sum, duration) => sum + duration, 0);
    const sampleRate = this.audioContext.sampleRate;
    const totalSamples = Math.ceil(totalDuration * sampleRate);
    
    // Create output buffer
    const outputBuffer = this.audioContext.createBuffer(
      sourceBuffer.numberOfChannels,
      totalSamples,
      sampleRate
    );

    // Calculate timing for each frame
    let currentTime = 0;
    for (let frameIndex = 0; frameIndex < frameDurations.length; frameIndex++) {
      const frameDuration = frameDurations[frameIndex];
      
      // Determine when to place the sound within the frame
      let soundTime = currentTime;
      if (syncMode === 'frame-center') {
        soundTime += frameDuration / 2;
      }
      
      // Calculate sample position
      const samplePosition = Math.floor(soundTime * sampleRate);
      
      // Copy source audio to output buffer at calculated position
      for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
        const sourceData = sourceBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);
        
        // Apply volume and copy samples
        for (let i = 0; i < sourceData.length && (samplePosition + i) < totalSamples; i++) {
          outputData[samplePosition + i] += sourceData[i] * audioSettings.volume;
        }
      }
      
      currentTime += frameDuration;
    }

    return outputBuffer;
  }

  // Convert AudioBuffer to WAV blob for video export
  audioBufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
  }

  cleanup(): void {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioBuffers.clear();
  }
}
