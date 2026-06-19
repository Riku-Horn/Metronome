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
 * Find the measure array index by absolute (cumulative) measure number.
 * Returns 0 if not found.
 */
export function findMeasureByAbsolute(song: SongData, absoluteMeasure: number): number {
  const idx = song.measures.findIndex(m => m.measure === absoluteMeasure);
  return idx >= 0 ? idx : 0;
}

/**
 * Get the array index where a section starts.
 * Returns 0 if not found.
 */
export function getSectionStartIndex(song: SongData, section: string): number {
  const idx = song.measures.findIndex(m => m.section === section);
  return idx >= 0 ? idx : 0;
}

/**
 * Compute and assign sectionMeasure for each measure in the array.
 * sectionMeasure is 1-indexed within each contiguous section.
 */
export function computeSectionMeasures(measures: MeasureData[]): void {
  let currentSection = '';
  let sectionCounter = 0;
  for (const m of measures) {
    if (m.section !== currentSection) {
      currentSection = m.section;
      sectionCounter = 1;
    }
    m.sectionMeasure = sectionCounter;
    sectionCounter++;
  }
}

/**
 * Check if an array of entries is in block format (has 'repeat' instead of 'measure').
 */
function isBlockFormat(entries: Record<string, unknown>[]): boolean {
  if (entries.length === 0) return false;
  const first = entries[0];
  return 'repeat' in first && !('measure' in first);
}

/**
 * Expand block-format entries into individual MeasureData[].
 * Supports isAlternating: when true, odd-indexed repeats use the block's
 * time signature and even-indexed repeats use 4/4.
 */
function expandBlocks(blocks: Record<string, unknown>[]): MeasureData[] {
  const measures: MeasureData[] = [];
  let m = 1;

  for (const block of blocks) {
    const repeat = block.repeat as number;
    const section = block.section as string;
    const numerator = block.numerator as number;
    const denominator = block.denominator as number;
    const target_bpm = block.target_bpm as number;
    const isAlternating = block.isAlternating as boolean | undefined;

    for (let r = 1; r <= repeat; r++) {
      let currentNumerator = numerator;
      let currentDenominator = denominator;

      if (isAlternating && r % 2 === 0) {
        currentNumerator = 4;
        currentDenominator = 4;
      }

      measures.push({
        measure: m,
        section,
        numerator: currentNumerator,
        denominator: currentDenominator,
        target_bpm,
      });

      m++;
    }
  }

  return measures;
}

/**
 * Validate and parse JSON song data.
 * Supports two input formats:
 *   1. Per-measure format: each entry has { measure, section, numerator, denominator, target_bpm }
 *   2. Block format: each entry has { repeat, section, numerator, denominator, target_bpm, isAlternating? }
 */
export function parseSongJson(json: string): SongData | { error: string } {
  try {
    const parsed = JSON.parse(json);

    // Handle both array format and object-with-measures format
    let rawEntries: Record<string, unknown>[];
    let title = 'Imported Song';

    if (Array.isArray(parsed)) {
      rawEntries = parsed;
    } else if (parsed.measures && Array.isArray(parsed.measures)) {
      rawEntries = parsed.measures;
      title = parsed.title || title;
    } else {
      return { error: 'Invalid format: expected an array or object with "measures" array' };
    }

    // Detect and expand block format if needed
    let measures: MeasureData[];
    if (isBlockFormat(rawEntries)) {
      // Validate block entries
      for (let i = 0; i < rawEntries.length; i++) {
        const b = rawEntries[i];
        if (!b.repeat || !b.section || !b.numerator || !b.denominator || !b.target_bpm) {
          return {
            error: `Block ${i + 1} is missing required fields (repeat, section, numerator, denominator, target_bpm)`,
          };
        }
      }
      measures = expandBlocks(rawEntries);
    } else {
      measures = rawEntries as unknown as MeasureData[];
      // Validate per-measure entries
      for (let i = 0; i < measures.length; i++) {
        const m = measures[i];
        if (!m.measure || !m.section || !m.numerator || !m.denominator || !m.target_bpm) {
          return {
            error: `Measure ${i + 1} is missing required fields (measure, section, numerator, denominator, target_bpm)`,
          };
        }
      }
    }

    // Auto-compute sectionMeasure for all measures
    computeSectionMeasures(measures);

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
