# Gestos

## Restricao de hardware

Apenas **1 webcam RGB**, sem profundidade. O eixo Z do MediaPipe e ruidoso, entao a
interacao trabalha com sinais 2D e com a **escala aparente da mao** em vez de 3D livre:

- Posicao da mao na tela (x, y) para girar e dar zoom.
- Distancia entre as duas maos para a escala do conjunto.
- Distancia entre as duas palmas na horizontal para controlar a vista explodida.

## Vocabulario

| Gesto | Efeito |
|---|---|
| Pinca com **1 mao** | gira a montagem |
| Pinca com **2 maos** | zoom (aproxima / afasta a camera) |
| **2 palmas** lado a lado (horizontal), afastar | explode a montagem (0-100%) |
| **2 palmas** lado a lado (horizontal), juntar | reconstroi a montagem |
| **Punho 2x** seguidas | restaura a vista (rotacao e zoom) |

> Selecionar, mover e remover pecas individuais ainda nao existem — estao no
> [roadmap](roadmap.md).

## Deteccao

As intencoes sao derivadas por regras geometricas sobre os 21 landmarks, sem modelo
treinado proprio:

- **Pinca**: razao `dist(polpa_polegar, polpa_indicador) / tamanho_da_palma`, com
  histerese (liga < 0.32, desliga > 0.45).
- **Punho**: as 4 pontas dos dedos ficam mais perto do pulso que os respectivos PIPs.
- **Palma aberta**: as 4 pontas ficam mais longe do pulso que os PIPs.
- **Palmas lado a lado**: os centros das duas maos precisam estar horizontalmente
  alinhados (angulo <= 10 graus).

## Anti-falsos-positivos

- **Histerese** nas transicoes de gesto (pinca).
- **Dwell** (permanencia) antes de engatar: pinca 120ms, punho 80ms, palma 150ms.
- **Alinhamento/angulo** exigido para as duas palmas.
- **Plausibilidade**: landmarks fora do frame ou com tamanho de mao implausivel sao
  descartados.
- **HandGate**: descarta maos duplicadas/aninhadas e atribui IDs estaveis entre frames.
