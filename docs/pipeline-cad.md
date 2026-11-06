# Pipeline CAD -> glTF

STEP/IGES **nao carregam no navegador**. 
A conversao para glTF acontece **offline, em build-time**, com Python.

## Fluxo

```
STEP/IGES ──► convert.py (cascadio / OCCT) ──► montagem.glb
                                            └─ montagem.parts.json  (metadados por peca)
```

## Conversor (cascadio)

O script `tools/cad2gltf/convert.py`:

1. Chama `cascadio.step_to_glb` (OCCT/XCAF), preservando nomes e cores por peca.
2. Le o chunk JSON do GLB e enumera os nos com malha.
3. Gera `parts.json` por peca, derivando `explodeDir` do centroide da peca.

## Formato de `parts.json`

```json
{
  "parts": [
    {
      "partId": "shaft-01",
      "name": "Eixo principal",
      "group": "transmissao",
      "explodeDir": [0, 1, 0],
      "material": "steel"
    }
  ]
}
```

`explodeDir` define a direcao da peca na vista explodida. Usa-se um **sidecar
JSON** em vez de embutir so no glTF porque direcoes de explosao quase nunca saem
boas automaticamente e precisam de ajuste manual facil.