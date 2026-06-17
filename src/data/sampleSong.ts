import type { SongData } from '../types/song';

/**
 * Sample song data for testing.
 * Includes mixed time signatures: 4/4 and 7/8
 */
export const sampleSong: SongData = {
  title: 'Sample Song — Mixed Meter',
  measures: [
    // Section A: 4/4 at 120 BPM
    { measure: 1,  section: 'A', numerator: 4, denominator: 4, target_bpm: 120 },
    { measure: 2,  section: 'A', numerator: 4, denominator: 4, target_bpm: 120 },
    { measure: 3,  section: 'A', numerator: 4, denominator: 4, target_bpm: 120 },
    { measure: 4,  section: 'A', numerator: 4, denominator: 4, target_bpm: 120 },

    // Section A continues: switch to 7/8
    { measure: 5,  section: 'A', numerator: 7, denominator: 8, target_bpm: 120 },
    { measure: 6,  section: 'A', numerator: 7, denominator: 8, target_bpm: 120 },

    // Section A: back to 4/4
    { measure: 7,  section: 'A', numerator: 4, denominator: 4, target_bpm: 120 },
    { measure: 8,  section: 'A', numerator: 4, denominator: 4, target_bpm: 120 },

    // Section B: 7/8 at 132 BPM
    { measure: 9,  section: 'B', numerator: 7, denominator: 8, target_bpm: 132 },
    { measure: 10, section: 'B', numerator: 7, denominator: 8, target_bpm: 132 },
    { measure: 11, section: 'B', numerator: 7, denominator: 8, target_bpm: 132 },
    { measure: 12, section: 'B', numerator: 7, denominator: 8, target_bpm: 132 },

    // Section C: mixed at 124 BPM
    { measure: 13, section: 'C', numerator: 4, denominator: 4, target_bpm: 124 },
    { measure: 14, section: 'C', numerator: 4, denominator: 4, target_bpm: 124 },
    { measure: 15, section: 'C', numerator: 7, denominator: 8, target_bpm: 124 },
    { measure: 16, section: 'C', numerator: 4, denominator: 4, target_bpm: 124 },
  ],
};
