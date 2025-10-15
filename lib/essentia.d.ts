// Type declarations for essentia.js
declare module 'essentia.js' {
  export interface EssentiaModule {
    HEAPF32: Float32Array;
    _malloc(size: number): number;
    _free(ptr: number): void;
  }

  export interface EssentiaVector {
    size(): number;
    get(index: number): number;
    delete(): void;
  }

  export interface RhythmExtractorOutput {
    bpm: number;
    beats: EssentiaVector;
    confidence: number;
    estimates: EssentiaVector;
    bpmIntervals: EssentiaVector;
  }

  export class Essentia {
    constructor(module: EssentiaModule, isDebug?: boolean);
    
    version: string;
    algorithmNames: string[];
    
    // Core utilities
    arrayToVector(array: Float32Array | number[]): EssentiaVector;
    vectorToArray(vector: EssentiaVector): Float32Array;
    shutdown(): void;
    delete(): void;
    
    // Beat detection algorithms
    RhythmExtractor2013(
      signal: any,
      method?: string,
      maxTempo?: number,
      minTempo?: number
    ): RhythmExtractorOutput;
    
    BeatTrackerDegara(signal: any, maxTempo?: number, minTempo?: number): {
      ticks: Float32Array;
    };
    
    BeatTrackerMultiFeature(signal: any, maxTempo?: number, minTempo?: number): {
      ticks: Float32Array;
      confidence: number;
    };
    
    // Audio loading utilities
    getAudioBufferFromURL(url: string, audioContext: AudioContext): Promise<AudioBuffer>;
  }

  export const EssentiaWASM: EssentiaModule;
  
  export default Essentia;
}
