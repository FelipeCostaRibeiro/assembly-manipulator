export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right' | 'Unknown';

export interface TrackedHand {
  id: number;
  handedness: Handedness;
  score: number;
  landmarks: Landmark[];
  center: Landmark;
  confidence: number;
}

export interface TrackedFrame {
  timestamp: number;
  hands: TrackedHand[];
}
