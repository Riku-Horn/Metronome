import type { SongData } from '../types/song';
import tsukumogamiJson from '../../tsukumogami.json';
import { parseSongJson } from '../utils/songParser';

const parsed = parseSongJson(JSON.stringify(tsukumogamiJson));

export const sampleSong: SongData = 'error' in parsed ? {
  title: '九十九神 (読み込みエラー)',
  measures: [],
} : {
  title: '九十九神',
  measures: parsed.measures,
};
