<div align="center">

# Assembly Manipulator

### *Controle montagens mecânicas 3D com gestos das mãos.*

[![TypeScript](https://img.shields.io/badge/typescript-7-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/three.js-0.187-000000?style=flat-square)](https://threejs.org/)
[![MediaPipe](https://img.shields.io/badge/mediapipe-tasks--vision-00897b?style=flat-square)](https://ai.google.dev/edge/mediapipe)
[![Vite](https://img.shields.io/badge/vite-8-646cff?style=flat-square)](https://vitejs.dev/)

**Manipulador de montagens CAD em 3D controlado por gestos.** Importe uma montagem
(STEP/IGES convertido para glTF), gire, dê zoom, exploda e reconstrua o conjunto com
as mãos capturadas por uma webcam comum. Construído com TypeScript, Three.js e
MediaPipe.

</div>

---

## O que é

O **Assembly Manipulator** é um visualizador de montagens mecânicas controlado por
gestos. O MediaPipe identifica 21 pontos da mão em tempo real num Web Worker, uma
camada de interpretação traduz gestos em comandos e o Three.js aplica as transformações
na árvore de peças — incluindo a vista explodida animada.

100% local. Sem servidor em tempo real, sem treinar modelo próprio, deploy estático.

**Stack:** TypeScript · Three.js · MediaPipe Tasks · Vite · Python + cascadio (apenas em build-time)

---

## Como rodar

Requer **Node.js 18+** + webcam.

```bash
npm install        # dependências
npm run assets     # copia o wasm do MediaPipe e baixa o modelo hand_landmarker.task
npm run dev        # servidor de desenvolvimento
```

O `npm run assets` gera `public/wasm/` e `public/models/` (binários pesados, fora do
controle de versão) — rode uma vez após clonar.

| Comando | Ação |
|---|---|
| `npm run dev` | servidor de desenvolvimento (Vite) |
| `npm run build` | typecheck + build de produção |
| `npm run preview` | serve o build de produção |
| `npm run typecheck` | checagem de tipos |
| `npm run assets` | copia wasm e baixa modelo do MediaPipe |

Ao abrir o app, permita o acesso à câmera. Posicione a mão a ~40–60cm da webcam.

---

## Gestos

| Gesto | Símbolo | Ação |
|---|:---:|---|
| Pinça com uma mão | 🤏 | Gira a montagem |
| Pinça com as duas mãos | 🤏🤏 | Zoom (aproxima / afasta a câmera) |
| Duas palmas lado a lado, afastar | 👐 | Explode a montagem (0–100%) |
| Duas palmas lado a lado, juntar | 👐 | Reconstrói a montagem |
| Punho duas vezes seguidas | ✊ | Restaura a vista |

As ações só engatam após um pequeno **dwell** (permanência) e passam por **histerese**
nas transições, para evitar disparos acidentais. Mãos fora do frame ou implausíveis
são descartadas.

> Seleção de peça por raycast, mover e remover peças individuais estão no
> [roadmap](docs/roadmap.md).

---

## Como funciona

```
webcam → MediaPipe (Web Worker, OffscreenCanvas)
          ↓
     Tracking        ← landmarks 2D/3D + handedness
          ↓
     Normalização    ← suavização One-Euro + cálculo de pinça/punho/palma
          ↓
     Interpretação   ← gesto → intenção (ROTATE, ZOOM, EXPLODE…) + dwell
          ↓
     Orquestração    ← máquina de modo (idle / rotate / zoom / explode)
          ↓
     Modelo          ← Assembly: árvore de peças + metadados (parts.json)
          ↓
     Render          ← Three.js atualiza transforms; anima a vista explodida
```

O tracking roda numa thread separada (`Worker` + `OffscreenCanvas`) para não competir
com o render, e apenas os landmarks são enviados ao main thread via `postMessage`.

Camadas isoladas por contrato: `landmarks → intenção → comando → transform`.
`tracking` não importa Three.js; `model` não conhece MediaPipe; Python nunca é chamado
pelo app. Isso permite trocar qualquer camada sem afetar as outras.

Estrutura de pastas:

```
src/
  tracking/     mediapipe em Web Worker + suavização (One-Euro)
  gesture/      gesto → intenção
  model/        árvore de peças + vista explodida
  render/       Three.js, carregamento do glb, raycast
  ui/           overlay e feedback (HUD)
tools/cad2gltf/ conversor STEP/IGES → glTF (Python, build-time)
docs/           arquitetura, gestos, pipeline CAD e roadmap
```

---

## Pipeline CAD

STEP/IGES **não carregam no navegador**. A conversão para glTF acontece offline, uma
única vez, com Python:

```
STEP/IGES ──► convert.py (cascadio / OCCT) ──► montagem.glb
                                            └─ montagem.parts.json
```

```bash
pip install -r tools/cad2gltf/requirements.txt
python tools/cad2gltf/convert.py caminho/para/peca.step -o public/assemblies/minha-peca.glb
```

O script preserva nomes e cores por peça e gera um `parts.json` com metadados —
inclusive `explodeDir`, a direção de cada peça na vista explodida. Detalhes e
motivações em [docs/pipeline-cad.md](docs/pipeline-cad.md).

---

## Documentação

- [Arquitetura](docs/arquiteture.md) — stack, camadas, contratos e fronteira runtime/build-time
- [Gestos](docs/gestos.md) — vocabulário de gestos e regra de mãos
- [Pipeline CAD](docs/pipeline-cad.md) — conversão STEP/IGES → glTF

---

## Contribuir

Issues, PRs e feedback técnico são bem-vindos. Antes de abrir um PR, rode:

```bash
npm run typecheck
npm run build
```

---

<div align="center">

Feito com Three.js + MediaPipe · [@felipeCostaRibeiro](https://github.com/felipeCostaRibeiro)

</div>
