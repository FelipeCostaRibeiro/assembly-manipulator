import * as THREE from 'three';
import { loadAssembly, type Part } from '../model/assembly';
import { loadExplode, offsetsAt, type ExplodeConfig } from '../model/explode';

export interface Rotation {
  x: number;
  y: number;
  z: number;
}

export class Scene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly pivot = new THREE.Group();
  private readonly viewDir = new THREE.Vector3(0.7, 0.5, 1).normalize();

  private parts: Part[] = [];
  private explodeConfig: ExplodeConfig | null = null;
  private initialDistance = 5;
  private distance = 5;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x10141c);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2));

    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(4, 7, 6);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.8);
    fill.position.set(-5, 2, -4);
    this.scene.add(fill);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.scene.add(this.pivot);
    this.resize();
  }

  async load(glbUrl: string, partsUrl: string, explodeUrl: string): Promise<void> {
    const assembly = await loadAssembly(glbUrl, partsUrl);

    const center = assembly.box.getCenter(new THREE.Vector3());
    assembly.root.position.sub(center);
    this.pivot.add(assembly.root);

    this.parts = assembly.parts;
    this.explodeConfig = await loadExplode(explodeUrl);
    this.frameCamera(assembly.box);
  }

  setExplode(amount: number): void {
    const progress = THREE.MathUtils.clamp(amount, 0, 1);
    const offsets = this.explodeConfig ? offsetsAt(this.explodeConfig, progress) : null;

    for (const part of this.parts) {
      part.mesh.position.copy(part.origin);
      if (offsets) {
        const offset = offsets.get(part.meta.partId);
        if (offset) part.mesh.position.add(new THREE.Vector3(offset[0], offset[1], offset[2]));
      } else {
        part.mesh.position.addScaledVector(part.explode, progress);
      }
    }
  }

  private frameCamera(box: THREE.Box3): void {
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitHeight = maxDim / (2 * Math.tan((Math.PI * this.camera.fov) / 360));
    const fitWidth = fitHeight / this.camera.aspect;
    this.initialDistance = 1.3 * Math.max(fitHeight, fitWidth);

    this.camera.lookAt(0, 0, 0);
    this.setCameraDistance(this.initialDistance);
  }

  setCameraDistance(distance: number): void {
    const min = this.initialDistance * 0.3;
    const max = this.initialDistance * 3;
    this.distance = THREE.MathUtils.clamp(distance, min, max);
    this.camera.position.copy(this.viewDir).multiplyScalar(this.distance);
    this.camera.near = this.distance / 100;
    this.camera.far = this.distance * 200;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  getCameraDistance(): number {
    return this.distance;
  }

  setRotation(rotation: Rotation): void {
    this.pivot.rotation.set(rotation.x, rotation.y, rotation.z);
  }

  getRotation(): Rotation {
    return {
      x: this.pivot.rotation.x,
      y: this.pivot.rotation.y,
      z: this.pivot.rotation.z,
    };
  }

  resetView(): void {
    this.pivot.rotation.set(0, 0, 0);
    this.setCameraDistance(this.initialDistance);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.setCameraDistance(this.distance);
  }
}
