import { useMemo } from 'react';
import type { SongData } from '../types/song';
import { getSections, getMeasuresInSection, findMeasureIndex } from '../utils/songParser';

interface PositionSelectorProps {
  song: SongData | null;
  currentMeasureIndex: number;
  onJumpTo: (measureIndex: number) => void;
}

export function PositionSelector({ song, currentMeasureIndex, onJumpTo }: PositionSelectorProps) {
  const sections = useMemo(() => {
    if (!song) return [];
    return getSections(song);
  }, [song]);

  const currentSection = useMemo(() => {
    if (!song || song.measures.length === 0) return '';
    return song.measures[currentMeasureIndex]?.section || sections[0] || '';
  }, [song, currentMeasureIndex, sections]);

  const measuresInCurrentSection = useMemo(() => {
    if (!song || !currentSection) return [];
    return getMeasuresInSection(song, currentSection);
  }, [song, currentSection]);

  const handleSectionChange = (section: string) => {
    if (!song) return;
    // Jump to the first measure of the selected section
    const idx = findMeasureIndex(song, section, getMeasuresInSection(song, section)[0]?.measure || 1);
    onJumpTo(idx);
  };

  const handleMeasureChange = (measureNumber: number) => {
    if (!song) return;
    const idx = findMeasureIndex(song, currentSection, measureNumber);
    onJumpTo(idx);
  };

  const handleReset = () => {
    onJumpTo(0);
  };

  if (!song) return null;

  return (
    <div className="position-selector" id="position-selector">
      <div className="position-selector-header">
        <span className="position-selector-label">再生位置</span>
        <button
          className="position-reset-btn"
          onClick={handleReset}
          id="reset-position"
          aria-label="先頭に戻る"
        >
          ⏮ 先頭
        </button>
      </div>

      <div className="position-selector-row">
        <div className="position-field">
          <label className="position-field-label" htmlFor="section-select">練習番号</label>
          <select
            id="section-select"
            className="position-select"
            value={currentSection}
            onChange={(e) => handleSectionChange(e.target.value)}
          >
            {sections.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="position-field">
          <label className="position-field-label" htmlFor="measure-select">小節</label>
          <select
            id="measure-select"
            className="position-select"
            value={song.measures[currentMeasureIndex]?.measure || 1}
            onChange={(e) => handleMeasureChange(parseInt(e.target.value, 10))}
          >
            {measuresInCurrentSection.map(m => (
              <option key={m.measure} value={m.measure}>
                {m.measure}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
