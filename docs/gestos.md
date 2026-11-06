# Gestos

## Restricao de hardware

Apenas **1 webcam RGB**, sem profundidade. O eixo Z do MediaPipe e ruidoso, entao
a manipulacao trabalha com **planos**, nao em 3D livre:

- Mover peca no **plano perpendicular a camera** (arrastar na tela).
- **Escala aparente da mao** (largura da palma / distancia da pinca) como proxy de Z.
- **Distancia entre as duas maos** para escala do conjunto.
- Rotacao via **twist da mao** (angulo pulso -> indicador).

## Vocabulario

| Intencao | Gesto | Efeito |
|---|---|---|
| GRAB / MOVE | pinca fechada | move peca no plano da tela |
| DEPTH | aproximar/afastar a mao (escala) | move no Z com ganho baixo |
| ROTATE | twist pulso -> indicador | rotaciona peca |
| ZOOM / ORBIT | palma esquerda | controla a camera |
| SELECT | point + dwell 1s | seleciona peca |
| REMOVE | punho + swipe | remove peca |
| EXPLODE | duas palmas lado a lado (horizontal): afastar / juntar | controla a vista explodida (0–100%) |

## Regra de maos

**Mao esquerda = camera, mao direita = peca.** Resolve a confusao de modos sem
menus.

## Anti-falsos-positivos

- **Histerese** nas transicoes de gesto.
- **Dwell** (permanencia) para selecao e confirmacao.
- **Zona de confirmacao** para evitar disparo acidental.
