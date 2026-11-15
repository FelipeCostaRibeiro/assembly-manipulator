# 3D Assembly Manipulator — Documentacao

Sistema de visao computacional para importar montagens de pecas 3D e manipula-las
com movimentos das maos, com foco em **demonstracao**.

## Indice

- [Arquitetura](architecture.md) — stack, camadas, contratos, estrutura de pastas
- [Pipeline CAD](pipeline-cad.md) — do export do CAD ao glTF + parts.json
- [Gestos](gestures.md) — vocabulario de gestos e deteccao
- [Roadmap](roadmap.md) — fases de implementacao

## Decisoes ja tomadas

| Pergunta | Decisao |
|---|---|
| Plataforma alvo | **Web** (Three.js + MediaPipe), deploy estatico |
| Formato de entrada | **glTF/GLB** (export do CAD); STEP/IGES via conversor de fallback |
| Hardware de captura | **Webcam RGB comum** (1 camera, sem profundidade) |
| Modelos de CV | **Somente pre-treinados** (MediaPipe). Sem treinar modelo proprio |
| Papel do Python | **Somente build-time** (conversao CAD e tooling). Fora do runtime |

## Principios

1. **Implementar incrementalmente** — apenas o necessario para cada tarefa, seguindo o roadmap.
2. **Camadas isoladas** — cada modulo nao conhece a tecnologia da camada vizinha.
3. **Python fora do runtime** — o app web nao chama Python; a conversao acontece uma vez, offline.
