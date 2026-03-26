// Browser audio recording utilities using the MediaRecorder API.
// Handles microphone permission, recording lifecycle, silence detection, and blob assembly.

export type AudioFormat = 'audio/webm' | 'audio/mp4' | 'audio/ogg';

export interface RecorderOptions {
  onDataAvailable?: (blob: Blob) => void;
  onStop?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  timeslice?: number;
  silenceDetection?: boolean;
  silenceThreshold?: number; // 0-1, default 0.01
  silenceTimeout?: number; // ms, default 1500
  onSpeechStart?: () => void;
}

/**
 * Detects the best supported audio MIME type for the current browser.
 */
export function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return '';
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private options: RecorderOptions;
  private silenceCheckInterval: ReturnType<typeof setInterval> | null = null;
  private silenceAudioContext: AudioContext | null = null;
  private silenceAnalyser: AnalyserNode | null = null;
  private silentSince: number | null = null;
  private hasSpoken = false;
  private destroyed = false;

  constructor(options: RecorderOptions = {}) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
        video: false,
      });
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Microphone access denied or unavailable.');
      this.options.onError?.(error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.stream) {
      await this.initialize();
    }

    if (!this.stream || this.destroyed) {
      throw new Error('No audio stream available.');
    }

    this.chunks = [];

    const mimeType = getSupportedMimeType();
    const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
    } catch {
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
        this.options.onDataAvailable?.(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(this.chunks, { type: mimeType });
      this.options.onStop?.(blob);
    };

    this.mediaRecorder.onerror = (event) => {
      const error = new Error(`MediaRecorder error: ${event.type}`);
      this.options.onError?.(error);
    };

    const timeslice = this.options.timeslice ?? 250;
    this.mediaRecorder.start(timeslice);

    if (this.options.silenceDetection && this.stream) {
      this.startSilenceDetection();
    }
  }

  private startSilenceDetection(): void {
    if (!this.stream) return;

    const threshold = this.options.silenceThreshold ?? 0.01;
    const timeout = this.options.silenceTimeout ?? 1500;

    this.silenceAudioContext = new AudioContext();
    const source = this.silenceAudioContext.createMediaStreamSource(this.stream);
    this.silenceAnalyser = this.silenceAudioContext.createAnalyser();
    this.silenceAnalyser.fftSize = 256;
    source.connect(this.silenceAnalyser);

    const dataArray = new Uint8Array(this.silenceAnalyser.frequencyBinCount);
    this.hasSpoken = false;
    this.silentSince = null;

    this.silenceCheckInterval = setInterval(() => {
      if (!this.silenceAnalyser || !this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        return;
      }

      this.silenceAnalyser.getByteFrequencyData(dataArray);
      const level = dataArray.reduce((a, b) => a + b, 0) / (dataArray.length * 255);

      if (level > threshold) {
        if (!this.hasSpoken) {
          this.hasSpoken = true;
          this.options.onSpeechStart?.();
        }
        this.silentSince = null;
      } else if (this.hasSpoken) {
        if (!this.silentSince) {
          this.silentSince = Date.now();
        } else if (Date.now() - this.silentSince >= timeout) {
          this.stop();
        }
      }
    }, 100);
  }

  private stopSilenceDetection(): void {
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
    if (this.silenceAudioContext) {
      this.silenceAudioContext.close().catch(() => {});
      this.silenceAudioContext = null;
    }
    this.silenceAnalyser = null;
    this.silentSince = null;
    this.hasSpoken = false;
  }

  stop(): void {
    this.stopSilenceDetection();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  get isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused';
  }

  get state(): RecordingState {
    return (this.mediaRecorder?.state ?? 'inactive') as RecordingState;
  }
}

export type RecordingState = 'inactive' | 'recording' | 'paused';

export function blobToFile(blob: Blob, filename = 'recording'): File {
  const ext = blob.type.includes('mp4')
    ? 'mp4'
    : blob.type.includes('ogg')
    ? 'ogg'
    : 'webm';

  return new File([blob], `${filename}.${ext}`, { type: blob.type });
}

export function playAudioBlob(blob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(url);
  });

  audio.play().catch((err) => {
    console.error('Audio playback failed:', err);
    URL.revokeObjectURL(url);
  });

  return audio;
}

export function createAudioAnalyser(stream: MediaStream): {
  analyser: AnalyserNode;
  getLevel: () => number;
  cleanup: () => void;
} {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const getLevel = (): number => {
    analyser.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    return sum / (dataArray.length * 255);
  };

  const cleanup = () => {
    source.disconnect();
    audioContext.close();
  };

  return { analyser, getLevel, cleanup };
}
