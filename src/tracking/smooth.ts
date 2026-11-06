class LowPass {
  private value = 0;
  private initialized = false;

  filter(input: number, alpha: number): number {
    if (!this.initialized) {
      this.value = input;
      this.initialized = true;
      return input;
    }
    this.value = alpha * input + (1 - alpha) * this.value;
    return this.value;
  }

  reset(): void {
    this.initialized = false;
    this.value = 0;
  }
}

export interface OneEuroOptions {
  minCutoff?: number;
  beta?: number;
  derivativeCutoff?: number;
}

export class OneEuroFilter {
  private readonly lowPass = new LowPass();
  private readonly derivative = new LowPass();
  private lastTime = 0;
  private lastRaw: number | null = null;

  constructor(private readonly options: OneEuroOptions = {}) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(input: number, timestamp: number): number {
    const dt = this.lastTime === 0 ? 1 / 60 : (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const safeDt = Math.max(dt, 1 / 240);

    const { minCutoff = 1, beta = 0.007, derivativeCutoff = 1 } = this.options;
    const rawDerivative = this.lastRaw === null ? 0 : (input - this.lastRaw) / safeDt;
    this.lastRaw = input;

    const smoothedDerivative = this.derivative.filter(
      rawDerivative,
      OneEuroFilter.alpha(derivativeCutoff, safeDt),
    );
    const cutoff = minCutoff + beta * Math.abs(smoothedDerivative);
    return this.lowPass.filter(input, OneEuroFilter.alpha(cutoff, safeDt));
  }

  reset(): void {
    this.lowPass.reset();
    this.derivative.reset();
    this.lastTime = 0;
    this.lastRaw = null;
  }
}

export class Vec3Filter {
  private readonly x = new OneEuroFilter();
  private readonly y = new OneEuroFilter();
  private readonly z = new OneEuroFilter();

  filter(point: { x: number; y: number; z: number }, timestamp: number): { x: number; y: number; z: number } {
    return {
      x: this.x.filter(point.x, timestamp),
      y: this.y.filter(point.y, timestamp),
      z: this.z.filter(point.z, timestamp),
    };
  }
}
