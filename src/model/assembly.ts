import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

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
  mesh: THREE.Object3D;
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

function fixColorSpace(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      standard.color?.convertSRGBToLinear();
    }
  });
}

function createLoader(): GLTFLoader {
  const manager = new THREE.LoadingManager();

  const skipDds: THREE.Loader = {
    load: (_url: string, _onLoad: unknown, _onProgress: unknown, onError?: (e: Error) => void) => {
      console.warn('Textura .dds ignorada (formato nao suportado pela web):', _url);
      onError?.(new Error('dds nao suportado'));
    },
  } as unknown as THREE.Loader;
  manager.addHandler(/\.dds$/i, skipDds);

  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  loader.setDRACOLoader(draco);
  return loader;
}

export async function loadAssembly(glbUrl: string, partsUrl: string): Promise<Assembly> {
  const response = await fetch(partsUrl);
  if (!response.ok) throw new Error(`parts.json: HTTP ${response.status}`);
  const { parts: metaList } = (await response.json()) as { parts: PartMeta[] };

  const gltf = await createLoader().loadAsync(glbUrl);
  const root = gltf.scene;
  fixColorSpace(root);

  const objectsByKey = new Map<string, THREE.Object3D>();
  const meshesInOrder: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshesInOrder.push(object as THREE.Mesh);
    const key = objectKey(object);
    if (key && !objectsByKey.has(key)) objectsByKey.set(key, object);
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const explodeScale = (Math.max(size.x, size.y, size.z) || 1) * 0.6;

  const parts: Part[] = [];
  metaList.forEach((meta, index) => {
    const object = objectsByKey.get(meta.node) ?? meshesInOrder[index];
    if (!object) return;

    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && !mesh.material) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: PALETTE[index % PALETTE.length],
        roughness: 0.5,
        metalness: 0.25,
      });
    }
    object.userData.partId = meta.partId;

    parts.push({
      meta,
      mesh: object,
      origin: object.position.clone(),
      explode: new THREE.Vector3(...meta.explodeDir).multiplyScalar(explodeScale),
    });
  });

  return { root, parts, box };
}
