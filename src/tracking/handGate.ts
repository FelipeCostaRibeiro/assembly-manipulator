import type { TrackedHand } from './types';

const DUPLICATE_DIST = 0.6;
const NESTED_FRACTION = 0.6;
const MAX_JUMP = 2.5;
const MAX_MISSED = 5;

type Box = [number, number, number, number];

interface Track {
  id: number;
  pos: { x: number; y: number };
  frames: number;
  missed: number;
  seen: boolean;
}

function palmPoint(hand: TrackedHand): { x: number; y: number } {
  const lm = hand.landmarks[9];
  return { x: lm.x, y: lm.y };
}

function palmSize(hand: TrackedHand): number {
  const a = hand.landmarks[0];
  const b = hand.landmarks[9];
  return Math.max(1e-3, Math.hypot(a.x - b.x, a.y - b.y));
}

function bbox(hand: TrackedHand): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of hand.landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return [minX, minY, maxX, maxY];
}

function insideFraction(inner: Box, outer: Box): number {
  const w = Math.min(inner[2], outer[2]) - Math.max(inner[0], outer[0]);
  const h = Math.min(inner[3], outer[3]) - Math.max(inner[1], outer[1]);
  if (w <= 0 || h <= 0) return 0;
  const area = Math.max(1e-9, (inner[2] - inner[0]) * (inner[3] - inner[1]));
  return (w * h) / area;
}

export class HandGate {
  private tracks: Track[] = [];
  private nextId = 1;

  constructor(private readonly confirmFrames = 3) {}

  reset(): void {
    this.tracks = [];
    this.nextId = 1;
  }

  filter(hands: TrackedHand[]): TrackedHand[] {
    return this.confirm(this.dropRepeated(hands));
  }

  private dropRepeated(hands: TrackedHand[]): TrackedHand[] {
    if (hands.length < 2) return hands.slice();
    const ordered = hands.slice().sort((a, b) => {
      const sa = Math.round(palmSize(a) * 1000) / 1000;
      const sb = Math.round(palmSize(b) * 1000) / 1000;
      if (sb !== sa) return sb - sa;
      return b.score - a.score;
    });
    const kept: TrackedHand[] = [];
    for (const hand of ordered) {
      if (!kept.some((other) => this.repeats(hand, other))) kept.push(hand);
    }
    return hands.filter((hand) => kept.includes(hand));
  }

  private repeats(a: TrackedHand, b: TrackedHand): boolean {
    const pa = palmPoint(a);
    const pb = palmPoint(b);
    const limit = DUPLICATE_DIST * Math.max(palmSize(a), palmSize(b));
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) <= limit) return true;
    const [small, big] = palmSize(a) <= palmSize(b) ? [a, b] : [b, a];
    return insideFraction(bbox(small), bbox(big)) >= NESTED_FRACTION;
  }

  private confirm(hands: TrackedHand[]): TrackedHand[] {
    for (const track of this.tracks) track.seen = false;
    const out: TrackedHand[] = [];
    for (const hand of hands) {
      let track = this.match(hand);
      if (!track) {
        track = { id: this.nextId++, pos: palmPoint(hand), frames: 1, missed: 0, seen: true };
        this.tracks.push(track);
      } else {
        track.pos = palmPoint(hand);
        track.frames += 1;
        track.missed = 0;
        track.seen = true;
      }
      if (track.frames >= this.confirmFrames) out.push({ ...hand, id: track.id });
    }
    for (const track of this.tracks) {
      if (!track.seen) track.missed += 1;
    }
    this.tracks = this.tracks.filter((track) => track.missed <= MAX_MISSED);
    return out;
  }

  private match(hand: TrackedHand): Track | undefined {
    const pos = palmPoint(hand);
    const limit = MAX_JUMP * palmSize(hand);
    let best: Track | undefined;
    let bestD = Infinity;
    for (const track of this.tracks) {
      if (track.seen) continue;
      const d = Math.hypot(pos.x - track.pos.x, pos.y - track.pos.y);
      if (d <= limit && d < bestD) {
        best = track;
        bestD = d;
      }
    }
    return best;
  }
}
