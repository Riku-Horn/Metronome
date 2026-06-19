/** Song data type definitions */

/** A single measure in a song */
export interface MeasureData {
  /** Measure number (1-indexed) */
  measure: number;
  /** Rehearsal section label (e.g., "A", "B", "C") */
  section: string;
  /** Time signature numerator (e.g., 4 in 4/4, 7 in 7/8) */
  numerator: number;
  /** Time signature denominator (e.g., 4 in 4/4, 8 in 7/8) */
  denominator: number;
  /** Target BPM (quarter note basis) for this measure */
  target_bpm: number;
  /** Measure number within the section (1-indexed, auto-computed) */
  sectionMeasure?: number;
  /** Optional custom beat pattern override (e.g., ['A','B','A','B','A','A','A']) */
  beat_pattern?: ('A' | 'B')[];
}

/** Complete song data */
export interface SongData {
  title: string;
  measures: MeasureData[];
}

/** Current playback position */
export interface PlaybackPosition {
  /** Current measure index (0-indexed into measures array) */
  measureIndex: number;
  /** Current sub-beat within the measure (0-indexed) */
  beatIndex: number;
  /** Whether the metronome is currently playing */
  isPlaying: boolean;
}

/** Beat event emitted by the audio engine for UI synchronization */
export interface BeatEvent {
  /** Which measure we're in (0-indexed) */
  measureIndex: number;
  /** Which sub-beat within the measure (0-indexed) */
  beatIndex: number;
  /** The sound type triggered: 'A' (accent) or 'B' (sub) */
  soundType: 'A' | 'B';
  /** The audio context time when this beat plays */
  time: number;
}
