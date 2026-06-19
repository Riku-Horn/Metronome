import { useMemo } from 'react';
import type { SongData } from '../types/song';
import { getSections, getMeasuresInSection, getSectionStartIndex } from '../utils/songParser';

/** How many pre-section measures to show (-5 to -1) */
const PRE_SECTION_COUNT = 5;

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

  const currentMeasure = useMemo(() => {
    if (!song || song.measures.length === 0) return null;
    return song.measures[currentMeasureIndex] || song.measures[0];
  }, [song, currentMeasureIndex]);

  const currentSection = currentMeasure?.section || sections[0] || '';

  const measuresInCurrentSection = useMemo(() => {
    if (!song || !currentSection) return [];
    return getMeasuresInSection(song, currentSection);
  }, [song, currentSection]);

  /**
   * Build the section-relative measure options including -5 to -1 pre-section entries.
   * Returns an array of { label, arrayIndex } where arrayIndex is the index into song.measures.
   */
  const sectionMeasureOptions = useMemo(() => {
    if (!song || !currentSection) return [];

    const sectionStart = getSectionStartIndex(song, currentSection);
    const options: { label: string; arrayIndex: number }[] = [];

    // Add pre-section measures (-5 to -1) if there are preceding measures
    for (let offset = PRE_SECTION_COUNT; offset >= 1; offset--) {
      const targetIndex = sectionStart - offset;
      if (targetIndex >= 0) {
        options.push({ label: String(-offset), arrayIndex: targetIndex });
      }
    }

    // Add actual section measures (1, 2, 3, ...)
    for (const m of measuresInCurrentSection) {
      const idx = song.measures.indexOf(m);
      options.push({ label: String(m.sectionMeasure ?? m.measure), arrayIndex: idx });
    }

    return options;
  }, [song, currentSection, measuresInCurrentSection]);

  /**
   * The currently selected sectionMeasure option value (arrayIndex as string).
   */
  const currentSectionMeasureValue = String(currentMeasureIndex);

  const handleSectionChange = (section: string) => {
    if (!song) return;
    // Jump to the first measure of the selected section
    const idx = getSectionStartIndex(song, section);
    onJumpTo(idx);
  };

  const handleSectionMeasureChange = (arrayIndex: number) => {
    onJumpTo(arrayIndex);
  };

  const handleAbsoluteMeasureChange = (absoluteMeasure: number) => {
    if (!song) return;
    const idx = song.measures.findIndex(m => m.measure === absoluteMeasure);
    if (idx >= 0) onJumpTo(idx);
  };

  if (!song) return null;

  return (
    <div className="position-selector" id="position-selector">
      <div className="position-selector-header">
        <span className="position-selector-label">再生位置</span>
      </div>

      <div className="position-selector-row">
        {/* Section selector */}
        <div className="position-field">
          <label className="position-field-label" htmlFor="section-select">練習番号</label>
          <select
            id="section-select"
            className="position-select"
            value={currentSection}
            onChange={(e) => handleSectionChange(e.target.value)}
          >
            {sections.map(s => (
              <option key={s} value={s}>{s.trim() || '(intro)'}</option>
            ))}
          </select>
        </div>

        {/* Section-relative measure selector (includes -5 to -1) */}
        <div className="position-field">
          <label className="position-field-label" htmlFor="section-measure-select">小節</label>
          <select
            id="section-measure-select"
            className="position-select"
            value={currentSectionMeasureValue}
            onChange={(e) => handleSectionMeasureChange(parseInt(e.target.value, 10))}
          >
            {sectionMeasureOptions.map(opt => (
              <option key={opt.arrayIndex} value={opt.arrayIndex}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Absolute measure selector */}
        <div className="position-field">
          <label className="position-field-label" htmlFor="absolute-measure-select">通し</label>
          <select
            id="absolute-measure-select"
            className="position-select"
            value={currentMeasure?.measure ?? 1}
            onChange={(e) => handleAbsoluteMeasureChange(parseInt(e.target.value, 10))}
          >
            {song.measures.map(m => (
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
