import type { Landmark, TrackedHand } from '../tracking/types';

const PINCH_ENTER = 0.32;
const PINCH_EXIT = 0.45;

export interface PinchState {
  pinching: boolean;
  center: Landmark;
  ratio: number;
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function computePinch(hand: TrackedHand, wasPinching: boolean): PinchState {
  const [wrist, , , , thumbTip, , , , indexTip, middleMcp] = hand.landmarks;

  const pinchDistance = distance(thumbTip, indexTip);
  const palmSize = distance(wrist, middleMcp) || 1e-6;
  const ratio = pinchDistance / palmSize;
  const pinching = wasPinching ? ratio < PINCH_EXIT : ratio < PINCH_ENTER;

  const center: Landmark = {
    x: (thumbTip.x + indexTip.x) / 2,
    y: (thumbTip.y + indexTip.y) / 2,
    z: (thumbTip.z + indexTip.z) / 2,
  };

  return { pinching, center, ratio };
}

const FINGER_TIPS = [8, 12, 16, 20];
const FINGER_PIPS = [6, 10, 14, 18];

export function isFist(hand: TrackedHand, margin = 0.95): boolean {
  const landmarks = hand.landmarks;
  const wrist = landmarks[0];
  let curled = 0;
  for (let i = 0; i < FINGER_TIPS.length; i += 1) {
    const tipDistance = distance(landmarks[FINGER_TIPS[i]], wrist);
    const pipDistance = distance(landmarks[FINGER_PIPS[i]], wrist);
    if (tipDistance < pipDistance * margin) curled += 1;
  }
  return curled === FINGER_TIPS.length;
}

export function isOpenPalm(hand: TrackedHand, margin = 1.05): boolean {
  const landmarks = hand.landmarks;
  const wrist = landmarks[0];
  let extended = 0;
  for (let i = 0; i < FINGER_TIPS.length; i += 1) {
    const tipDistance = distance(landmarks[FINGER_TIPS[i]], wrist);
    const pipDistance = distance(landmarks[FINGER_PIPS[i]], wrist);
    if (tipDistance > pipDistance * margin) extended += 1;
  }
  return extended === FINGER_TIPS.length;
}
