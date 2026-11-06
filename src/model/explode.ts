export interface ExplodeMove {
  partId: string;
  offset: [number, number, number];
}

export interface ExplodeStage {
  name?: string;
  moves: ExplodeMove[];
}

export interface ExplodeConfig {
  stages: ExplodeStage[];
}

export async function loadExplode(url: string): Promise<ExplodeConfig | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as ExplodeConfig;
  } catch {
    return null;
  }
}

type Vec3 = [number, number, number];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function offsetsAt(config: ExplodeConfig, progress: number): Map<string, Vec3> {
  const stages = config.stages;
  const count = Math.max(stages.length, 1);
  const result = new Map<string, Vec3>();

  stages.forEach((stage, index) => {
    const local = clamp01((progress - index / count) * count);
    if (local <= 0) return;
    for (const move of stage.moves) {
      const current = result.get(move.partId) ?? [0, 0, 0];
      result.set(move.partId, [
        current[0] + move.offset[0] * local,
        current[1] + move.offset[1] * local,
        current[2] + move.offset[2] * local,
      ]);
    }
  });

  return result;
}
