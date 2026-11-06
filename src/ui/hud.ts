import type { TrackedHand } from '../tracking/types';

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export class HandOverlay {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D nao disponivel');
    this.ctx = ctx;
  }

  draw(hands: TrackedHand[]): void {
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    if (!width || !height) return;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;

    const { ctx } = this;
    ctx.clearRect(0, 0, width, height);

    for (const hand of hands) {
      const points = hand.landmarks.map((point) => ({
        x: (1 - point.x) * width,
        y: point.y * height,
      }));

      ctx.strokeStyle = '#7dff8f';
      ctx.lineWidth = 3;
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
      }

      ctx.fillStyle = '#4c8dff';
      for (const point of points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
