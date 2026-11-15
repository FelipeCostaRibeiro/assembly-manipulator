# Roadmap

Fases de implementacao do projeto, na ordem em que foram desenvolvidas.

## Concluidas

### 1. Definicao de stack e arquitetura

- Escolha de TypeScript + Vite, Three.js e MediaPipe Tasks.
- Definicao das camadas isoladas e do contrato
  `landmarks -> intencao -> comando -> transform`.
- Fronteira build-time (Python) x runtime (browser) e deploy estatico.

### 2. Carregamento e visualizacao de pecas CAD 3D

- Pipeline de conversao/geracao de metadados (`cad/` -> `public/assemblies/`).
- Carregamento do glTF/GLB com Three.js e enquadramento automatico da camera.
- `parts.json` com `explodeDir` por peca.

### 3. Deteccao de movimento das maos (visao computacional)

- MediaPipe `HandLandmarker` em Web Worker, recebendo frames como `ImageBitmap`.
- Overlay 2D dos landmarks sobre o video.

### 4. Aprimoramento da identificacao dos gestos

- `HandGate` para IDs estaveis e descarte de maos duplicadas/aninhadas.
- `RobustHandAnchor` para um centro ponderado robusto ao ruido.
- Filtro One-Euro para suavizacao.
- Histerese, dwell e regras de plausibilidade.

### 5. Renderizacao com cores e textura

- Preservacao de materiais/cores PBR do glTF.
- Correcao de color space (sRGB -> linear) para exports do SolidWorks.
- Suporte a texturas (PNG/JPEG) e a compressao Draco; texturas DDS ignoradas com aviso.

## Futuro

- Criacao em tempo real da vista explodida por gestos, com selecao por **raycast**.
- Importacao de pecas CAD pela propria interface (sem passar pelo CLI).
