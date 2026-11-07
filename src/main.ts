import './styles.css';
import { HandTracker } from './tracking/tracker';
import { Vec3Filter } from './tracking/smooth';
import { computePinch, isFist, isOpenPalm, type PinchState } from './gesture/interpret';
import { Scene } from './render/scene';
import { HandOverlay } from './ui/hud';
import type { Landmark, TrackedHand } from './tracking/types';

const GLB_URL = '/assemblies/Montagem_CyberPhone.glb';
const PARTS_URL = '/assemblies/Montagem_CyberPhone.parts.json';
const EXPLODE_URL = '/assemblies/Montagem_CyberPhone.explode.json';

const ROTATE_SENSITIVITY = 8.0;
const FIST_RESET_WINDOW = 1000;
const PALM_MAX_ANGLE_DEG = 10;
const PALM_MIN_SEPARATION = 0.06;
const PALM_GATHER_TRIGGER = 0.14;
const PALM_SPREAD_TRIGGER = 0.3;
const EXPLODE_TRANSITION_MS = 700;
const PALM_ARM_MS = 250;
const PINCH_DWELL_MS = 120;
const FIST_DWELL_MS = 80;
const PALM_DWELL_MS = 150;

type Mode = 'idle' | 'rotate' | 'zoom';

const video = document.querySelector<HTMLVideoElement>('#video')!;
const overlayCanvas = document.querySelector<HTMLCanvasElement>('#overlay')!;
const sceneCanvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const status = document.querySelector<HTMLDivElement>('#status')!;

const scene = new Scene(sceneCanvas);
const overlay = new HandOverlay(overlayCanvas, video);

const filters = new Map<number, Vec3Filter[]>();
const pinchWas = new Map<number, boolean>();
const prevFist = new Map<number, boolean>();
let knownIds = new Set<number>();

let mode: Mode = 'idle';
let lastFistTime = -Infinity;
let rotateStart = { x: 0, y: 0 };
let rotateBase = { x: 0, y: 0, z: 0 };
let zoomStartHandDist = 1;
let zoomStartCamDist = 1;
let explodeProgress = 0;
let palmArmSince = 0;
let palmSpreadWas = false;
let palmGatheredWas = false;
let explodeAnimating = false;
let explodeAnimFrom = 0;
let explodeTarget = 0;
let explodeAnimStart = 0;
let palmAngleDeg: number | null = null;

function smoothHand(hand: TrackedHand, timestamp: number): TrackedHand {
  let handFilters = filters.get(hand.id);
  if (!handFilters) {
    handFilters = Array.from({ length: hand.landmarks.length }, () => new Vec3Filter());
    filters.set(hand.id, handFilters);
  }
  return {
    ...hand,
    landmarks: hand.landmarks.map((point, index) => handFilters![index].filter(point, timestamp)),
  };
}

function landmarkDistance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function horizontallyAligned(a: Landmark, b: Landmark): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (Math.hypot(dx, dy) < PALM_MIN_SEPARATION) return true;
  return Math.atan2(dy, dx) <= (PALM_MAX_ANGLE_DEG * Math.PI) / 180;
}

function angleFromHorizontalDeg(a: Landmark, b: Landmark): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function horizontalDistance(a: Landmark, b: Landmark): number {
  return Math.abs(a.x - b.x);
}

class Dwell {
  private readonly starts = new Map<string, number>();

  engaged(key: string, active: boolean, timestamp: number, durationMs: number): boolean {
    if (!active) {
      this.starts.delete(key);
      return false;
    }
    const start = this.starts.get(key);
    if (start === undefined) {
      this.starts.set(key, timestamp);
      return durationMs <= 0;
    }
    return timestamp - start >= durationMs;
  }

  reset(key: string): void {
    this.starts.delete(key);
  }
}

const dwell = new Dwell();

function isPlausibleHand(hand: TrackedHand): boolean {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of hand.landmarks) {
    if (point.x < -0.1 || point.x > 1.1 || point.y < -0.1 || point.y > 1.1) return false;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const size = Math.hypot(maxX - minX, maxY - minY);
  return size >= 0.08 && size <= 0.9;
}

interface HandGesture {
  key: number;
  pinch: PinchState;
  pinching: boolean;
  fist: boolean;
  openPalm: boolean;
  center: Landmark;
}

function updateHud(gestureCount: number): void {
  if (gestureCount === 0) {
    status.textContent = 'Sem mao detectada';
    return;
  }
  const label = { idle: 'aguardando gesto', rotate: 'girando montagem', zoom: 'zoom' }[mode];
  const angle = palmAngleDeg === null ? '' : ` | angulo: ${palmAngleDeg.toFixed(0)}`;
  status.textContent = `Modo: ${label} | Vista explodida: ${Math.round(explodeProgress * 100)}%${angle}`;
}

function startExplodeAnimation(target: number, now: number): void {
  if (explodeTarget === target && explodeAnimating) return;
  explodeAnimFrom = explodeProgress;
  explodeTarget = target;
  explodeAnimStart = now;
  explodeAnimating = Math.abs(explodeProgress - target) > 1e-3;
  if (!explodeAnimating) explodeProgress = target;
}

function applyZoom(pinchHands: HandGesture[]): void {
  const distance = landmarkDistance(pinchHands[0].pinch.center, pinchHands[1].pinch.center);
  if (mode !== 'zoom') {
    mode = 'zoom';
    zoomStartHandDist = distance;
    zoomStartCamDist = scene.getCameraDistance();
  }
  if (zoomStartHandDist > 1e-3) {
    scene.setCameraDistance(zoomStartCamDist * (zoomStartHandDist / distance));
  }
}

function applyRotate(hand: HandGesture): void {
  const center = hand.pinch.center;
  if (mode !== 'rotate') {
    mode = 'rotate';
    rotateStart = { x: center.x, y: center.y };
    rotateBase = scene.getRotation();
  }
  const dx = center.x - rotateStart.x;
  const dy = center.y - rotateStart.y;
  scene.setRotation({
    x: rotateBase.x + dy * ROTATE_SENSITIVITY,
    y: rotateBase.y - dx * ROTATE_SENSITIVITY,
    z: rotateBase.z,
  });
}

function updatePalmExplode(palmHands: HandGesture[], timestamp: number): void {
  mode = 'idle';

  const palmAligned =
    palmHands.length >= 2 && horizontallyAligned(palmHands[0].center, palmHands[1].center);

  if (!palmAligned) {
    palmArmSince = 0;
    palmSpreadWas = false;
    palmGatheredWas = false;
    return;
  }

  if (palmArmSince === 0) palmArmSince = timestamp;
  if (timestamp - palmArmSince < PALM_ARM_MS) return;

  const distance = horizontalDistance(palmHands[0].center, palmHands[1].center);
  const spread = distance >= PALM_SPREAD_TRIGGER;
  const gathered = distance <= PALM_GATHER_TRIGGER;

  if (spread && !palmSpreadWas) startExplodeAnimation(1, timestamp);
  if (gathered && !palmGatheredWas) startExplodeAnimation(0, timestamp);

  palmSpreadWas = spread;
  palmGatheredWas = gathered;
}

function handleManipulation(gestures: HandGesture[], timestamp: number): void {
  const pinchHands = gestures.filter((g) => g.pinching && !g.fist);
  const palmHands = gestures.filter((g) => g.openPalm && !g.pinching && !g.fist);
  palmAngleDeg =
    palmHands.length >= 2 ? angleFromHorizontalDeg(palmHands[0].center, palmHands[1].center) : null;

  if (pinchHands.length >= 2) {
    applyZoom(pinchHands);
    return;
  }

  if (pinchHands.length === 1) {
    applyRotate(pinchHands[0]);
    return;
  }

  updatePalmExplode(palmHands, timestamp);
}

function detectFistReset(gestures: HandGesture[], timestamp: number): void {
  for (const gesture of gestures) {
    const was = prevFist.get(gesture.key) ?? false;
    if (gesture.fist && !was) {
      if (timestamp - lastFistTime < FIST_RESET_WINDOW) {
        scene.resetView();
        lastFistTime = -Infinity;
      } else {
        lastFistTime = timestamp;
      }
    }
    prevFist.set(gesture.key, gesture.fist);
  }
}

const tracker = new HandTracker(video, {
  onReady: () => {
    status.textContent = 'Palmas lado a lado (horizontal): afastar explode, juntar reconstroi. Pinca = girar; 2 pincas = zoom; punho 2x = reset.';
  },
  onError: (message) => {
    status.textContent = message;
  },
  onFrame: (frame) => {
    const hands = frame.hands.map((hand) => smoothHand(hand, frame.timestamp));
    overlay.draw(hands);

    const plausible = hands.filter(isPlausibleHand);
    const present = new Set(plausible.map((hand) => hand.id));
    for (const id of knownIds) {
      if (!present.has(id)) {
        dwell.reset(`${id}:pinch`);
        dwell.reset(`${id}:fist`);
        dwell.reset(`${id}:palm`);
        filters.delete(id);
        pinchWas.delete(id);
        prevFist.delete(id);
      }
    }
    knownIds = present;

    const timestamp = frame.timestamp;
    const gestures: HandGesture[] = plausible.map((hand) => {
      const key = hand.id;
      const was = pinchWas.get(key) ?? false;
      const pinch = computePinch(hand, was);
      pinchWas.set(key, pinch.pinching);
      return {
        key,
        pinch,
        pinching: dwell.engaged(`${key}:pinch`, pinch.pinching, timestamp, PINCH_DWELL_MS),
        fist: dwell.engaged(`${key}:fist`, isFist(hand), timestamp, FIST_DWELL_MS),
        openPalm: dwell.engaged(`${key}:palm`, isOpenPalm(hand), timestamp, PALM_DWELL_MS),
        center: hand.center,
      };
    });

    detectFistReset(gestures, timestamp);
    handleManipulation(gestures, timestamp);
    updateHud(gestures.length);
  },
});

function updateExplodeAnimation(now: number): void {
  if (!explodeAnimating) return;
  const t = clamp01((now - explodeAnimStart) / EXPLODE_TRANSITION_MS);
  const eased = t * t * (3 - 2 * t);
  explodeProgress = explodeAnimFrom + (explodeTarget - explodeAnimFrom) * eased;
  if (t >= 1) {
    explodeProgress = explodeTarget;
    explodeAnimating = false;
  }
  scene.setExplode(explodeProgress);
}

function animate(): void {
  const now = performance.now();
  updateExplodeAnimation(now);
  requestAnimationFrame(animate);
  scene.render();
}

window.addEventListener('resize', () => scene.resize());
animate();

scene
  .load(GLB_URL, PARTS_URL, EXPLODE_URL)
  .then(() => {
    status.textContent = 'Montagem carregada. Palmas lado a lado (horizontal): afastar explode, juntar reconstroi.';
  })
  .catch((error) => {
    status.textContent = `Falha ao carregar montagem: ${String(error)}`;
  });

tracker.start().catch((error) => {
  status.textContent = `Falha ao acessar a camera: ${String(error)}`;
});
