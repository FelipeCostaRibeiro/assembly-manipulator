import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { TrackedFrame, TrackedHand } from './types';
import { HandGate } from './handGate';
import { RobustHandAnchor } from './anchor';

// URL absoluta: o Vite dev intercepta `import()` de arquivos em /public.
// Com origem explicita o import vira externo e e servido como estatico.
// useModule=true seleciona vision_wasm_module_internal.js (ESM), ideal para worker module.
const WASM_PATH = `${self.location.origin}/wasm`;
const MODEL_PATH = '/models/hand_landmarker.task';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let landmarker: HandLandmarker | null = null;
const gate = new HandGate();
const anchors = new Map<number, RobustHandAnchor>();

interface InitMessage {
  type: 'init';
}

interface FrameMessage {
  type: 'frame';
  bitmap: ImageBitmap;
  timestamp: number;
}

type InMessage = InitMessage | FrameMessage;

function serialize(result: HandLandmarkerResult): TrackedHand[] {
  return result.landmarks.map((landmarks, index) => {
    const category = result.handedness[index]?.[0];
    return {
      id: -1,
      handedness: (category?.categoryName as TrackedHand['handedness']) ?? 'Unknown',
      score: category?.score ?? 0,
      landmarks: landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z })),
      center: { x: 0, y: 0, z: 0 },
      confidence: 0,
    };
  });
}

function track(result: HandLandmarkerResult): TrackedHand[] {
  const gated = gate.filter(serialize(result));
  const liveIds = new Set<number>();
  const hands: TrackedHand[] = [];
  for (const hand of gated) {
    liveIds.add(hand.id);
    let anchor = anchors.get(hand.id);
    if (!anchor) {
      anchor = new RobustHandAnchor();
      anchors.set(hand.id, anchor);
    }
    const anchorResult = anchor.compute(hand.landmarks);
    hands.push({
      ...hand,
      center: { x: anchorResult.x, y: anchorResult.y, z: 0 },
      confidence: anchorResult.confidence,
    });
  }
  for (const id of anchors.keys()) {
    if (!liveIds.has(id)) anchors.delete(id);
  }
  return hands;
}

ctx.onmessage = async (event: MessageEvent<InMessage>) => {
  const message = event.data;

  if (message.type === 'init') {
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH, true);
      landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.65,
        minHandPresenceConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });
      ctx.postMessage({ type: 'ready' });
    } catch (error) {
      ctx.postMessage({ type: 'error', message: `Falha ao iniciar MediaPipe: ${String(error)}` });
    }
    return;
  }

  if (message.type === 'frame' && landmarker) {
    try {
      const result = landmarker.detectForVideo(message.bitmap, message.timestamp);
      const frame: TrackedFrame = {
        timestamp: message.timestamp,
        hands: track(result),
      };
      ctx.postMessage({ type: 'frame', frame });
    } catch (error) {
      ctx.postMessage({ type: 'error', message: `Falha no tracking: ${String(error)}` });
    } finally {
      message.bitmap.close();
    }
  } else {
    message.bitmap.close();
  }
};
