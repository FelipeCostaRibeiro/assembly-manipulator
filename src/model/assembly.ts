import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PALETTE = [
  0x6ea8fe, 0xf4a261, 0x81c784, 0xe07a5f,
  0xb39ddb, 0x4dd0e1, 0xffd54f, 0xf06292,
];

export interface PartMeta {
  partId: string;
  name: string;
  node: string;
  explodeDir: [number, number, number];
  material: string | null;
}

export interface Part {
  meta: PartMeta;
  mesh: THREE.Mesh;
  origin: THREE.Vector3;
  explode: THREE.Vector3;
}

export interface Assembly {
  root: THREE.Object3D;
  parts: Part[];
  box: THREE.Box3;
}

function objectKey(object: THREE.Object3D): string {
  return (object.userData?.name as string) || object.name;
}

export async function loadAssembly(glbUrl: string, partsUrl: string): Promise<Assembly> {
  const response = await fetch(partsUrl);
  if (!response.ok) throw new Error(`parts.json: HTTP ${response.status}`);
  const { parts: metaList } = (await response.json()) as { parts: PartMeta[] };

  const gltf = await new GLTFLoader().loadAsync(glbUrl);
  const root = gltf.scene;

  const meshesByKey = new Map<string, THREE.Mesh>();
  const meshesInOrder: THREE.Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      meshesInOrder.push(mesh);
      const key = objectKey(object);
      if (key) meshesByKey.set(key, mesh);
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const explodeScale = (Math.max(size.x, size.y, size.z) || 1) * 0.6;

  const parts: Part[] = [];
  metaList.forEach((meta, index) => {
    const mesh = meshesByKey.get(meta.node) ?? meshesInOrder[index];
    if (!mesh) return;

    mesh.material = new THREE.MeshStandardMaterial({
      color: PALETTE[index % PALETTE.length],
      roughness: 0.5,
      metalness: 0.25,
    });
    mesh.userData.partId = meta.partId;

    parts.push({
      meta,
      mesh,
      origin: mesh.position.clone(),
      explode: new THREE.Vector3(...meta.explodeDir).multiplyScalar(explodeScale),
    });
  });

  return { root, parts, box };
}
