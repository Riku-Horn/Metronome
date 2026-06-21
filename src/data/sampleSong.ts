import type { SongData } from '../types/song';
import tsukumogami1Json from '../../tsukumogami1.json';
import tsukumogami2Json from '../../tsukumogami2.json';
import { parseSongJson } from '../utils/songParser';

const parsed1 = parseSongJson(JSON.stringify(tsukumogami1Json));
const parsed2 = parseSongJson(JSON.stringify(tsukumogami2Json));

export const tsukumogami1Song: SongData = 'error' in parsed1 ? {
  title: 'tsukumogami1 (読み込みエラー)',
  measures: [],
} : {
  title: 'tsukumogami1',
  measures: parsed1.measures,
};

export const tsukumogami2Song: SongData = 'error' in parsed2 ? {
  title: 'tsukumogami2 (読み込みエラー)',
  measures: [],
} : {
  title: 'tsukumogami2',
  measures: parsed2.measures,
};

// Export tsukumogami2 as sampleSong for default initialization
export const sampleSong: SongData = tsukumogami2Song;

