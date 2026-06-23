import type { SongData } from '../types/song';
import concour2026_1Json from '../../concour2026_1.json';
import concour2026_2Json from '../../concour2026_2.json';
import { parseSongJson } from '../utils/songParser';

const parsed1 = parseSongJson(JSON.stringify(concour2026_1Json));
const parsed2 = parseSongJson(JSON.stringify(concour2026_2Json));

export const concour2026_1Song: SongData = 'error' in parsed1 ? {
  title: '第一楽章 (読み込みエラー)',
  measures: [],
} : {
  title: '第一楽章',
  measures: parsed1.measures,
};

export const concour2026_2Song: SongData = 'error' in parsed2 ? {
  title: '第二楽章 (読み込みエラー)',
  measures: [],
} : {
  title: '第二楽章',
  measures: parsed2.measures,
};

// Export concour2026_2 as sampleSong for default initialization
export const sampleSong: SongData = concour2026_2Song;

