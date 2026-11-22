export type BgmTrackId = 'cyberpunk' | 'boss-battle' | 'cosmic-chill' | 'retro-overdrive';
export type BgmIntensity = 'normal' | 'high' | 'critical';

export interface BgmTrackMetadata {
  id: BgmTrackId;
  name: string;
  bpm: number;
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  filterCutoffHz: number;
  leadNotes: number[];
  bassNotes: number[];
}

export const BGM_TRACKS: Record<BgmTrackId, BgmTrackMetadata> = {
  'cyberpunk': {
    id: 'cyberpunk',
    name: 'Cyberpunk Synth',
    bpm: 125,
    leadWave: 'sawtooth',
    bassWave: 'triangle',
    filterCutoffHz: 1650,
    // D Minor Synthwave Arpeggio (D4, F4, A4, C5, A4, F4, G4, A4)
    leadNotes: [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 392.0, 440.0],
    // Sub-bass (D2, D2, Bb1, C2)
    bassNotes: [73.42, 73.42, 58.27, 65.41],
  },
  'boss-battle': {
    id: 'boss-battle',
    name: '8-Bit Boss Battle',
    bpm: 148,
    leadWave: 'square',
    bassWave: 'sawtooth',
    filterCutoffHz: 2100,
    // E Phrygian Dark Arcade Run (E4, F4, G4, B4, C5, B4, G4, F4)
    leadNotes: [329.63, 349.23, 392.0, 493.88, 523.25, 493.88, 392.0, 349.23],
    // Driving Bass (E2, F2, G2, F2)
    bassNotes: [82.41, 87.31, 98.0, 87.31],
  },
  'cosmic-chill': {
    id: 'cosmic-chill',
    name: 'Cosmic Horizon',
    bpm: 96,
    leadWave: 'triangle',
    bassWave: 'sine',
    filterCutoffHz: 1100,
    // A Minor Pentatonic Space Pad (A4, C5, D5, E5, G5, E5, D5, C5)
    leadNotes: [440.0, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25],
    // Deep Space Sub (A2, F2, C2, G2)
    bassNotes: [110.0, 87.31, 65.41, 98.0],
  },
  'retro-overdrive': {
    id: 'retro-overdrive',
    name: 'Retro Overdrive',
    bpm: 136,
    leadWave: 'square',
    bassWave: 'triangle',
    filterCutoffHz: 1900,
    // Classic C Major Chiptune Anthem (C4, E4, G4, C5, G4, E4, D4, G4)
    leadNotes: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 392.0],
    // Octave Bounce Bass (C2, G2, A2, F2)
    bassNotes: [65.41, 98.0, 110.0, 87.31],
  },
};

export const INTENSITY_TEMPO_MULTIPLIER: Record<BgmIntensity, number> = {
  normal: 1.0,
  high: 1.15,
  critical: 1.32,
};

export function computeStepDurationSeconds(trackId: BgmTrackId, intensity: BgmIntensity): number {
  const track = BGM_TRACKS[trackId] || BGM_TRACKS['cyberpunk'];
  const mult = INTENSITY_TEMPO_MULTIPLIER[intensity] || 1.0;
  // 16th-note / 8th-note step duration from BPM
  const effectiveBpm = track.bpm * mult;
  return 60 / (effectiveBpm * 2);
}
