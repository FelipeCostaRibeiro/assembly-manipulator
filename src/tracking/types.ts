export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right' | 'Unknown';

export interface TrackedHand {
  handedness: Handedness;
  score: number;
  landmarks: Landmark[];
}

export interface TrackedFrame {
  timestamp: number;
  hands: TrackedHand[];
}
