# Arquitetura

## Stack

| Papel | Tecnologia | Onde roda |
|---|---|---|
| Hand tracking + gestos | MediaPipe Tasks (HandLandmarker / GestureRecognizer) | runtime, browser (Web Worker) |
| Render 3D | Three.js | runtime, browser |
| Logica de interacao | TypeScript + maquina de estados (xstate) | runtime, browser |
| Conversao CAD -> glTF | Python (cascadio / OCCT) | offline, build-time |
| Tooling de assets | Python (numpy, json) | offline |

Sem servidor em tempo real, sem treinar modelo proprio. Deploy e estatico.

## Fronteira runtime vs build-time

```
BUILD-TIME (Python)                    RUNTIME (JS/TS, estatico)
  STEP/IGES ──► convert.py               browser
                │  .glb + parts.json       ├─ MediaPipe worker -> landmarks
                └─────────────────────────► ├─ interpret -> intencao
                                            ├─ Three.js render
                                            └─ HUD feedback
```

## Camadas

```
[ Camera ]
    │ frame
    ▼
1. Tracking        MediaPipe -> landmarks 2D/3D + handedness + gesto bruto
    ▼
2. Normalizacao    suavizacao (One-Euro), calculo de pinca/punho/point
    ▼
3. Interpretacao   gesto -> intencao (GRAB, RELEASE, SELECT, PALM_MOVE, ...)
                   + histerese/dwell para evitar disparo acidental
    ▼
4. Orquestrador    maquina de estados (IDLE / NAVIGATE / MANIPULATE / EXPLODE)
                   selecao por raycast, modo de manipulacao
    ▼
5. Modelo          Assembly: arvore de Part { mesh, meta.name, explodeDir }
                   comandos: transform, remove, toggleExploded
    ▼
6. Render          Three.js atualiza transforms; animacao de explosao
```

## Contrato entre camadas

O fluxo de dados entre camadas e sempre simples e testavel isoladamente:

```
landmarks -> intencao -> comando -> transform
```

Regras de acoplamento:

- `tracking` **nao** importa Three.js.
- `model` **nao** conhece MediaPipe.
- Python **so** converte assets; nunca e chamado pelo app.

Isso permite trocar qualquer camada sem afetar as outras (ex.: substituir webcam
por Leap Motion, ou trocar "intencao" por um novo mapeamento).

## MediaPipe em Web Worker

O tracking roda em `Worker` com `OffscreenCanvas`, fora da thread de render, para
manter os 60fps. Apenas os landmarks (array pequeno) sao enviados ao main thread
via `postMessage`. Decisao tomada desde o inicio — refatorar depois e caro.

## Estrutura de pastas prevista

```
src/
  tracking/     mediapipe.ts      -> landmarks + handedness (Web Worker)
  tracking/     smooth.ts         -> One-Euro filter
  gesture/      interpret.ts      -> gesto -> intencao
  gesture/      stateMachine.ts   -> IDLE|NAVIGATE|MANIPULATE|EXPLODE
  model/        assembly.ts       -> arvore de pecas + metadata
  model/        commands.ts       -> transform / remove / toggleExploded
  render/       scene.ts          -> Three.js, carrega glb, raycast
  render/       explodedView.ts   -> anima explodeDir
  ui/           hud.ts            -> feedback (peca selecionada, gesto atual)
tools/
  cad2gltf/     convert.py        -> cascadio (OCCT) headless
```
