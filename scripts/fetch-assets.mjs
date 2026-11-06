import { cp, mkdir, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const wasmSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDest = path.join(root, 'public', 'wasm');
const modelDir = path.join(root, 'public', 'models');
const modelDest = path.join(modelDir, 'hand_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

await mkdir(wasmDest, { recursive: true });
await cp(wasmSrc, wasmDest, { recursive: true });
console.log(`wasm copiado para ${path.relative(root, wasmDest)}`);

try {
  await access(modelDest);
  console.log('modelo ja existe, download ignorado');
} catch {
  await mkdir(modelDir, { recursive: true });
  console.log('baixando modelo hand_landmarker.task...');
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar o modelo`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(modelDest));
  console.log(`modelo salvo em ${path.relative(root, modelDest)}`);
}
