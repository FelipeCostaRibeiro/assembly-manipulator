# Arquitetura

## Stack

| Papel | Tecnologia | Onde roda |
|---|---|---|
| Hand tracking | MediaPipe Tasks (HandLandmarker) | runtime, browser (Web Worker) |
| Render 3D | Three.js | runtime, browser |
| Logica de interacao | TypeScript (maquina de modo ad-hoc) | runtime, browser |
| Suavizacao | Filtro One-Euro (implementacao propria) | runtime, browser |
| Geracao de glTF + parts.json | Python | offline, build-time |
| Tooling de assets | Node.js (wasm, modelo, draco) | offline, build-time |

Sem servidor em tempo real, sem treinar modelo proprio. Deploy e estatico.

## Fronteira runtime vs build-time

```
BUILD-TIME (Node + Python)              RUNTIME (JS/TS, estatico)
  cad/<montagem>/ ──► prepare.mjs         browser
    (export do CAD)     + convert.py       ├─ MediaPipe worker -> landmarks
                 │  modelo + parts.json     ├─ interpret -> intencao
                 └─────────────────────────►├─ Three.js render
                                            └─ HUD feedback
```

## Camadas

```
[ Camera ]
    │ frame (ImageBitmap)
    ▼
1. Tracking        MediaPipe (Web Worker) -> landmarks 2D/3D + handedness
                   HandGate -> IDs estaveis, descarta duplicadas/aninhadas
                   RobustHandAnchor -> centro ponderado + confianca
    ▼
2. Normalizacao    suavizacao One-Euro por landmark; centro da mao
    ▼
3. Interpretacao   gesto -> intencao por regras geometricas (pinca, punho, palma)
                   + histerese e dwell para evitar disparo acidental
    ▼
4. Orquestracao    maquina de modo por contagem de gestos (idle / rotate / zoom)
                   explosao por duas palmas alinhadas
    ▼
5. Modelo          Assembly: arvore de Part { mesh, meta.name, explodeDir }
    ▼
6. Render          Three.js aplica rotacao, zoom e animacao da vista explodida
    ▼
7. HUD             overlay 2D desenha os landmarks sobre o video
```

## Contrato entre camadas

O fluxo de dados entre camadas e sempre simples e testavel isoladamente:

```
landmarks -> intencao -> comando -> transform
```

Regras de acoplamento:

- `tracking` **nao** importa Three.js.
- `model` **nao** conhece MediaPipe.
- Python **so** gera assets; nunca e chamado pelo app.

Isso permite trocar qualquer camada sem afetar as outras (ex.: substituir a webcam por
Leap Motion, ou trocar as regras de gesto por um novo mapeamento).

## MediaPipe em Web Worker

O tracking roda em `Worker` (`src/tracking/worker.ts`), fora da thread de render, para
manter os 60fps. A cada frame o main thread envia um `ImageBitmap` e recebe apenas os
landmarks (array pequeno) via `postMessage`. Decisao tomada desde o inicio — refatorar
depois e caro.

O `HandLandmarker` roda em `runningMode: 'VIDEO'`, com `numHands: 2` e limiares de
confianca em 0.65.

## Estrutura de pastas

```
src/
  tracking/   tracker.ts   -> loop de captura + Web Worker
  tracking/   worker.ts    -> MediaPipe + HandGate + anchor
  tracking/   handGate.ts  -> IDs estaveis de mao
  tracking/   anchor.ts    -> centro ponderado robusto
  tracking/   smooth.ts    -> filtro One-Euro
  gesture/    interpret.ts -> pinca / punho / palma aberta
  model/      assembly.ts  -> carrega glTF + parts.json -> arvore de Part
  model/      explode.ts   -> configuracao e offsets da vista explodida
  render/     scene.ts     -> Three.js, camera, rotacao, zoom, explode
  ui/         hud.ts       -> overlay 2D dos landmarks
  main.ts                  -> orquestracao (maquina de modo) e ligacao das camadas
tools/
  cad2gltf/   convert.py   -> gera parts.json (e converte STEP/IGES em fallback)
scripts/
  prepare.mjs              -> copia cad/ e roda convert.py (npm run assembly)
  fetch-assets.mjs         -> copia wasm/draco e baixa o modelo (npm run assets)
```
