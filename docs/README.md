# 3D Assembly Manipulator — Documentacao

Sistema de visao computacional para importar montagens de pecas 3D e manipula-las
com movimentos das maos, com foco em **demonstracao**.

## Indice

- [Arquitetura](arquitetura.md) — stack, camadas, contratos, estrutura de pastas
- [Pipeline CAD](pipeline-cad.md) — conversao STEP/IGES -> glTF com metadados
- [Gestos](gestos.md) — vocabulario de gestos e regra de maos
- [Roadmap](roadmap.md) — fases de implementacao com criterios de aceite

## Decisoes ja tomadas

| Pergunta | Decisao |
|---|---|
| Plataforma alvo | **Web** (Three.js + MediaPipe), deploy estatico |
| Formato de entrada | **STEP/IGES** (CAD parametrico) |
| Hardware de captura | **Webcam RGB comum** (1 camera, sem profundidade) |
| Modelos de CV | **Somente pre-treinados** (MediaPipe). Sem treinar modelo proprio |
| Papel do Python | **Somente build-time** (conversao CAD e tooling). Fora do runtime |

## Principios

1. **Implementar incrementalmente** — apenas o necessario para cada tarefa, seguindo o roadmap.
2. **Camadas isoladas** — cada modulo nao conhece a tecnologia da camada vizinha.
3. **Python fora do runtime** — o app web nao chama Python; a conversao acontece uma vez, offline.
