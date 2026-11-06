import type { TrackedFrame } from './types';

export interface TrackerCallbacks {
  onReady?: () => void;
  onError?: (message: string) => void;
  onFrame?: (frame: TrackedFrame) => void;
}

export class HandTracker {
  private readonly worker: Worker;
  private busy = false;
  private ready = false;
  private running = false;
  private rafId = 0;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly callbacks: TrackerCallbacks = {},
  ) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = (event) => this.callbacks.onError?.(event.message);
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    this.worker.postMessage({ type: 'init' });
  }

  private handleMessage = (event: MessageEvent): void => {
    const message = event.data;
    if (message.type === 'ready') {
      this.ready = true;
      this.callbacks.onReady?.();
      this.startLoop();
    } else if (message.type === 'error') {
      this.callbacks.onError?.(message.message);
    } else if (message.type === 'frame') {
      this.busy = false;
      this.callbacks.onFrame?.(message.frame);
    }
  };

  private startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (this.busy || !this.ready || this.video.readyState < 2) return;

    this.busy = true;
    const timestamp = performance.now();
    createImageBitmap(this.video)
      .then((bitmap) => this.worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]))
      .catch(() => {
        this.busy = false;
      });
  };

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.worker.terminate();
  }
}
