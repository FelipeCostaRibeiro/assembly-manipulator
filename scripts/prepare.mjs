import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const name = process.argv[2];
if (!name) {
  console.error('uso: npm run assembly <nome-da-montagem>');
  console.error('ex.:  npm run assembly Montagem_CyberPhone');
  process.exit(1);
}

const srcDir = path.join(root, 'cad', name);
if (!existsSync(srcDir)) {
  console.error(`Pasta de origem nao encontrada: ${path.relative(root, srcDir)}`);
  process.exit(1);
}

const outDir = path.join(root, 'public', 'assemblies');
await mkdir(outDir, { recursive: true });
await cp(srcDir, outDir, { recursive: true, force: true });
console.log(`Importados copiados: cad/${name} -> public/assemblies`);

const modelFile = [`${name}.gltf`, `${name}.glb`]
  .map((file) => path.join(outDir, file))
  .find((file) => existsSync(file));
if (!modelFile) {
  console.error(`Modelo ${name}.gltf/.glb nao encontrado em public/assemblies`);
  process.exit(1);
}

const venvPython = path.join(root, '.venv', 'Scripts', 'python.exe');
const python = existsSync(venvPython) ? venvPython : 'python';
const convert = path.join(root, 'tools', 'cad2gltf', 'convert.py');

const result = spawnSync(python, [convert, modelFile], { stdio: 'inherit' });
process.exit(result.status ?? 1);
