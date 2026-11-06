#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

import cascadio

JSON_CHUNK = 0x4E4F534A


def read_glb_json(path: Path) -> dict:
    data = path.read_bytes()
    magic, version, _length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError("Nao e um arquivo GLB valido")
    if version != 2:
        raise ValueError(f"Versao GLB nao suportada: {version}")

    offset = 12
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        if chunk_type == JSON_CHUNK:
            return json.loads(data[offset : offset + chunk_length].decode("utf-8"))
        offset += chunk_length + (4 - chunk_length % 4) % 4

    raise ValueError("Chunk JSON nao encontrado no GLB")


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def node_position(node: dict) -> tuple[float, float, float]:
    if "matrix" in node:
        m = node["matrix"]
        return (m[12], m[13], m[14])
    translation = node.get("translation", [0.0, 0.0, 0.0])
    return (translation[0], translation[1], translation[2])


def load_step_names(step_path: Path) -> dict[str, str]:
    text = step_path.read_text(errors="ignore")
    products = {
        m.group(1): m.group(2)
        for m in re.finditer(r"#(\d+)\s*=\s*PRODUCT\s*\(\s*'([^']*)'", text)
    }
    formations = {
        m.group(1): m.group(2)
        for m in re.finditer(
            r"#(\d+)\s*=\s*PRODUCT_DEFINITION_FORMATION(?:_WITH_SPECIFIED_SOURCE)?"
            r"\s*\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*#(\d+)",
            text,
        )
    }
    definitions = {
        m.group(1): m.group(2)
        for m in re.finditer(
            r"#(\d+)\s*=\s*PRODUCT_DEFINITION\s*\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*#(\d+)",
            text,
        )
    }

    names: dict[str, str] = {}
    for match in re.finditer(
        r"#\d+\s*=\s*NEXT_ASSEMBLY_USAGE_OCCURRENCE\s*\(\s*'([^']*)'(.*?)\)\s*;",
        text,
        re.S,
    ):
        instance = match.group(1)
        ids = re.findall(r"#(\d+)", match.group(2))
        if len(ids) < 2:
            continue
        formation = definitions.get(ids[-1])
        product = formations.get(formation) if formation else None
        name = products.get(product) if product else None
        if name:
            names[instance] = name

    return names


def unique_part_id(base_id: str, used_ids: set[str]) -> str:
    part_id = base_id
    suffix = 2
    while part_id in used_ids:
        part_id = f"{base_id}-{suffix}"
        suffix += 1
    used_ids.add(part_id)
    return part_id


def explode_direction(
    position: tuple[float, float, float],
    center: tuple[float, float, float],
) -> list[float]:
    direction = [position[i] - center[i] for i in range(3)]
    norm = sum(d * d for d in direction) ** 0.5
    if norm > 1e-9:
        return [d / norm for d in direction]
    return [0.0, 1.0, 0.0]


def resolve_material(node: dict, meshes: list, materials: list) -> str | None:
    if node["mesh"] >= len(meshes):
        return None
    primitives = meshes[node["mesh"]].get("primitives", [])
    if not primitives or "material" not in primitives[0]:
        return None
    material_index = primitives[0]["material"]
    if material_index >= len(materials):
        return None
    return materials[material_index].get("name")


def build_parts(gltf: dict, name_map: dict[str, str] | None = None) -> list[dict]:
    nodes = gltf.get("nodes", [])
    meshes = gltf.get("meshes", [])
    materials = gltf.get("materials", [])

    positions = [node_position(node) for node in nodes]
    count = len(positions) or 1
    center = tuple(sum(p[i] for p in positions) / count for i in range(3))

    used_ids: set[str] = set()
    parts: list[dict] = []

    for index, node in enumerate(nodes):
        if "mesh" not in node:
            continue

        node_name = node.get("name") or f"part-{index}"
        name = (name_map or {}).get(node_name, node_name)
        base_id = slug(name) or f"part-{index}"
        part_id = unique_part_id(base_id, used_ids)
        explode_dir = explode_direction(node_position(node), center)

        parts.append(
            {
                "partId": part_id,
                "name": name,
                "node": node_name,
                "explodeDir": [round(value, 4) for value in explode_dir],
                "material": resolve_material(node, meshes, materials),
            }
        )

    return parts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Arquivo STEP/IGES de entrada")
    parser.add_argument("-o", "--output", type=Path, help="Caminho do .glb de saida")
    parser.add_argument("--tol-linear", type=float, default=0.1)
    parser.add_argument("--tol-angular", type=float, default=0.5)
    parser.add_argument("--tol-relative", action="store_true")
    args = parser.parse_args()

    if not args.input.is_file():
        print(f"Entrada nao encontrada: {args.input}", file=sys.stderr)
        return 1

    output = args.output or args.input.with_suffix(".glb")

    print(f"Convertendo {args.input.name} -> {output.name} ...")
    cascadio.step_to_glb(
        str(args.input),
        str(output),
        tol_linear=args.tol_linear,
        tol_angular=args.tol_angular,
        tol_relative=args.tol_relative,
        merge_primitives=True,
        include_materials=True,
    )

    gltf = read_glb_json(output)
    name_map = load_step_names(args.input) if args.input.suffix.lower() in {".step", ".stp"} else {}
    parts = build_parts(gltf, name_map)

    parts_path = output.with_suffix(".parts.json")
    parts_path.write_text(
        json.dumps({"parts": parts}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"GLB gerado: {output} ({output.stat().st_size / 1e6:.1f} MB)")
    print(f"{len(parts)} pecas -> {parts_path.name}")
    for part in parts:
        print(f"  - {part['partId']:<24} explodeDir={part['explodeDir']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
