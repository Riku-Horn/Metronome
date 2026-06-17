import type { MeasureData, SongData } from '../types/song';

const STORAGE_KEY = 'metronome_song_data';

/**
 * Generate the beat pattern for a given measure.
 * - 4/4 time: 8 eighth notes → [A, B, A, B, A, B, A, B]
 * - 7/8 time: 7 eighth notes → [A, B, A, B, A, A, A] (2+2+3 grouping)
 * - Other: generates based on numerator with default alternating pattern
 */
export function getBeatPattern(measure: MeasureData): ('A' | 'B')[] {
  // Use custom pattern if provided
  if (measure.beat_pattern) {
    return measure.beat_pattern;
  }

  // 7/8: special ABABAAA pattern (2+2+3 grouping)
  if (measure.numerator === 7 && measure.denominator === 8) {
    return ['A', 'B', 'A', 'B', 'A', 'A', 'A'];
  }

  // For x/4 time signatures: double the numerator (play eighth notes)
  // e.g., 4/4 → 8 eighth notes: ABABABAB
  if (measure.denominator === 4) {
    const count = measure.numerator * 2;
    return Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 'A' : 'B') as 'A' | 'B');
  }

  // For x/8 time signatures: just use numerator count with alternating pattern
  const count = measure.numerator;
  return Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 'A' : 'B') as 'A' | 'B');
}

/**
 * Calculate the duration of one sub-beat (eighth note) in seconds.
 * BPM is always quarter-note based.
 */
export function getSubBeatDuration(bpm: number, denominator: number): number {
  const quarterNoteDuration = 60 / bpm;

  if (denominator === 4) {
    // For x/4 time: eighth note = half a quarter note
    return quarterNoteDuration / 2;
  }

  if (denominator === 8) {
    // For x/8 time: each eighth note = half a quarter note
    return quarterNoteDuration / 2;
  }

  // Fallback
  return quarterNoteDuration / 2;
}

/**
 * Get unique section labels from song data.
 */
export function getSections(song: SongData): string[] {
  const sections = new Set<string>();
  for (const m of song.measures) {
    sections.add(m.section);
  }
  return Array.from(sections);
}

/**
 * Get measures belonging to a specific section.
 */
export function getMeasuresInSection(song: SongData, section: string): MeasureData[] {
  return song.measures.filter(m => m.section === section);
}

/**
 * Find the index of a measure by section and measure number.
 * Returns 0 if not found.
 */
export function findMeasureIndex(song: SongData, section: string, measureNumber: number): number {
  const idx = song.measures.findIndex(
    m => m.section === section && m.measure === measureNumber
  );
  return idx >= 0 ? idx : 0;
}

/**
 * Validate and parse JSON song data.
 */
export function parseSongJson(json: string): SongData | { error: string } {
  try {
    const parsed = JSON.parse(json);

    // Handle both array format and object-with-measures format
    let measures: MeasureData[];
    let title = 'Imported Song';

    if (Array.isArray(parsed)) {
      measures = parsed;
    } else if (parsed.measures && Array.isArray(parsed.measures)) {
      measures = parsed.measures;
      title = parsed.title || title;
    } else {
      return { error: 'Invalid format: expected an array or object with "measures" array' };
    }

    // Validate each measure
    for (let i = 0; i < measures.length; i++) {
      const m = measures[i];
      if (!m.measure || !m.section || !m.numerator || !m.denominator || !m.target_bpm) {
        return {
          error: `Measure ${i + 1} is missing required fields (measure, section, numerator, denominator, target_bpm)`,
        };
      }
    }

    return { title, measures };
  } catch {
    return { error: 'Invalid JSON format' };
  }
}

/**
 * Save song data to localStorage.
 */
export function saveSongToStorage(song: SongData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
  } catch {
    console.warn('Failed to save song to localStorage');
  }
}

/**
 * Load song data from localStorage.
 */
export function loadSongFromStorage(): SongData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed && parsed.measures && Array.isArray(parsed.measures)) {
      return parsed as SongData;
    }
    return null;
  } catch {
    return null;
  }
}
