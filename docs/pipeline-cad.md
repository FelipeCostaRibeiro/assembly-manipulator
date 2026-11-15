# Pipeline CAD -> glTF

A **fonte CAD** fica em `cad/<montagem>/` (export do SolidWorks: `.gltf`/`.glb`,
`data.bin` e texturas). O que o app **carrega** fica em `public/assemblies/` e e
**gerado** por `npm run assembly <montagem>`.

## Fluxo

```
cad/<montagem>/            npm run assembly <montagem>         public/assemblies/
  montagem.gltf     ────────────────────────────────────►       montagem.gltf
  data.bin                                                      data.bin
  texturas...        1) copia a fonte                           texturas...
                     2) convert.py -> parts.json                 montagem.parts.json
```

Assim `public/assemblies/` (runtime) e 100% regeneravel e a fonte permanece
intacta em `cad/`.

## Preparar o runtime

```bash
# exporte do CAD para cad/Montagem_CyberPhone/
npm run assembly Montagem_CyberPhone
```

O script `scripts/prepare.mjs` copia `cad/<montagem>/` para `public/assemblies/` e
roda o conversor para gerar o `parts.json`.

### Fallback STEP/IGES

O conversor `tools/cad2gltf/convert.py` tambem aceita STEP/IGES (via
`cascadio`/OCCT), caso voce ainda queira converter a partir do STEP:

```bash
pip install -r tools/cad2gltf/requirements.txt
python tools/cad2gltf/convert.py caminho/para/peca.step -o public/assemblies/minha-peca.glb
```

Nesse modo ele chama `cascadio.step_to_glb`, le o GLB e gera o
`parts.json` com `explodeDir` derivado do centroide de cada peca.

## Gerar `parts.json` (entrada glTF/GLB)

Dado um glTF/GLB ja exportado pelo CAD, o conversor apenas le o arquivo e gera o
`montagem.parts.json` ao lado (o cascadio nao e chamado). E isso que o
`npm run assembly` faz automaticamente.

`partId` e derivado do **nome do no** do glTF. Para a vista explodida
(`explode.json`) continuar valendo, o nome do no deve corresponder ao nome da peca.
Requisitos: um mesh por no de peca e nomes de no iguais aos nomes das pecas.

### Limitacoes do export do CAD

- **Draco:** se o CAD exportar com compactacao Draco (ex.: SOLIDWORKS),
  o app ja decodifica via `DRACOLoader` (`public/draco/`, gerado por
  `npm run assets`). Nao precisa desligar no CAD.
- **Texturas DDS:** o SOLIDWORKS exporta aparências como `.dds`, formato que o
  WebGL nao le. Essas texturas sao **ignoradas com aviso** (o modelo carrega,
  mas sem o mapa). Exporte as texturas como **PNG/JPEG** para ve-las no app.
- Materiais e cores PBR do glTF sao preservados no render (nao sao mais
  sobrescritos pela palette).
- **Cores do SOLIDWORKS:** o SOLIDWORKS grava o `baseColorFactor` em sRGB, mas a
  spec do glTF define esse campo como linear. O app converte de volta para linear
  no carregamento, senao tudo renderiza ~2x mais claro.

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