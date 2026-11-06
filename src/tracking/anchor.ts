import type { Landmark } from './types';

const ANATOMY_WEIGHTS: number[] = [
  0.55, // 0  wrist
  0.25, 0.30, 0.35, 0.55, // 1-4  thumb
  1.00, 0.55, 0.45, 0.70, // 5-8  index
  1.00, 0.60, 0.50, 0.70, // 9-12 middle
  0.95, 0.55, 0.45, 0.65, // 13-16 ring
  0.85, 0.45, 0.40, 0.55, // 17-20 pinky
];
const ANATOMY_SUM_MAX = ANATOMY_WEIGHTS.reduce((sum, w) => sum + w, 0);

const EDGE_MARGIN = 0.06;
const STAB_WINDOW = 8;
const STAB_SCALE = 220;
const HYSTERESIS_BLEND = 0.35;
const CONFIDENCE_DROP_RATIO = 0.5;
const CONFIDENCE_FLOOR = 0.4;
const RESET_AFTER_LOST_FRAMES = 8;

export interface AnchorResult {
  x: number;
  y: number;
  confidence: number;
  used: number;
}

class LandmarkHistory {
  private readonly xs: number[] = [];
  private readonly ys: number[] = [];

  push(x: number, y: number): void {
    this.xs.push(x);
    this.ys.push(y);
    if (this.xs.length > STAB_WINDOW) this.xs.shift();
    if (this.ys.length > STAB_WINDOW) this.ys.shift();
  }

  get xValues(): readonly number[] {
    return this.xs;
  }

  get yValues(): readonly number[] {
    return this.ys;
  }
}

function edgeFactor(x: number, y: number, margin: number): number {
  if (margin <= 0) return 1;
  const fx = Math.min(x, 1 - x) / margin;
  const fy = Math.min(y, 1 - y) / margin;
  return Math.min(1, Math.max(0, fx)) * Math.min(1, Math.max(0, fy));
}

function stabilityFactor(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n < 2) return 1;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let ssd = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    ssd += dx * dx + dy * dy;
  }
  const variance = ssd / n;
  return 1 / (1 + STAB_SCALE * variance);
}

export class RobustHandAnchor {
  private histories: LandmarkHistory[] | null = null;
  private lastAnchor: { x: number; y: number } | null = null;
  private lastConfidence = 0;
  private lostFrames = 0;

  private lastOrCenter(): AnchorResult {
    if (this.lastAnchor) {
      return { x: this.lastAnchor.x, y: this.lastAnchor.y, confidence: 0, used: 0 };
    }
    return { x: 0.5, y: 0.5, confidence: 0, used: 0 };
  }

  private missed(): AnchorResult {
    this.lostFrames += 1;
    if (this.lostFrames >= RESET_AFTER_LOST_FRAMES) this.reset();
    return this.lastOrCenter();
  }

  compute(landmarks: Landmark[] | null): AnchorResult {
    if (!landmarks || landmarks.length < 21) return this.missed();

    this.lostFrames = 0;
    const n = landmarks.length;
    if (this.histories?.length !== n) {
      this.histories = Array.from({ length: n }, () => new LandmarkHistory());
    }

    let sumWx = 0;
    let sumWy = 0;
    let sumW = 0;
    let used = 0;
    for (let i = 0; i < n; i += 1) {
      const { x, y } = landmarks[i];
      const history = this.histories[i];
      history.push(x, y);

      const edge = edgeFactor(x, y, EDGE_MARGIN);
      if (edge <= 0) continue;
      const stability = stabilityFactor(history.xValues, history.yValues);
      const w = (ANATOMY_WEIGHTS[i] ?? 0.4) * edge * stability;
      if (w <= 1e-6) continue;

      sumWx += w * x;
      sumWy += w * y;
      sumW += w;
      used += 1;
    }

    if (sumW <= 1e-6) return this.lastOrCenter();

    let ax = sumWx / sumW;
    let ay = sumWy / sumW;
    const confidence = Math.min(1, sumW / Math.max(1e-6, ANATOMY_SUM_MAX * 0.4));

    if (
      this.lastAnchor &&
      confidence < this.lastConfidence * CONFIDENCE_DROP_RATIO &&
      confidence < CONFIDENCE_FLOOR
    ) {
      ax = HYSTERESIS_BLEND * ax + (1 - HYSTERESIS_BLEND) * this.lastAnchor.x;
      ay = HYSTERESIS_BLEND * ay + (1 - HYSTERESIS_BLEND) * this.lastAnchor.y;
    }

    this.lastAnchor = { x: ax, y: ay };
    this.lastConfidence = confidence;
    return { x: ax, y: ay, confidence, used };
  }

  reset(): void {
    this.histories = null;
    this.lastAnchor = null;
    this.lastConfidence = 0;
    this.lostFrames = 0;
  }
}
