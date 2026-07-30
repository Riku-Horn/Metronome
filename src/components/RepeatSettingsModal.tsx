import { useState, useMemo } from 'react';
import type { SongData } from '../types/song';
import { getSections, getMeasuresInSection, getSectionStartIndex } from '../utils/songParser';

interface RepeatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: SongData | null;
  currentRepeat: { startIndex: number; endIndex: number; countInEnabled: boolean } | null;
  onSetRepeat: (startIndex: number, endIndex: number, countInEnabled: boolean) => void;
  onClearRepeat: () => void;
}

export function RepeatSettingsModal({
  isOpen,
  onClose,
  song,
  currentRepeat,
  onSetRepeat,
  onClearRepeat,
}: RepeatSettingsModalProps) {
  // Internal state for the form
  const [startSection, setStartSection] = useState('');
  const [startMeasureIdx, setStartMeasureIdx] = useState(0);
  const [endSection, setEndSection] = useState('');
  const [endMeasureIdx, setEndMeasureIdx] = useState(0);
  const [countInEnabled, setCountInEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const sections = useMemo(() => {
    if (!song) return [];
    return getSections(song);
  }, [song]);

  // Initialize form values from current repeat or defaults when modal opens
  if (isOpen && !isInitialized && song && sections.length > 0) {
    if (currentRepeat) {
      // Pre-fill from current repeat configuration
      const startMeasure = song.measures[currentRepeat.startIndex];
      const endMeasure = song.measures[currentRepeat.endIndex];
      if (startMeasure && endMeasure) {
        setStartSection(startMeasure.section);
        setStartMeasureIdx(currentRepeat.startIndex);
        setEndSection(endMeasure.section);
        setEndMeasureIdx(currentRepeat.endIndex);
        setCountInEnabled(currentRepeat.countInEnabled);
      }
    } else {
      // Default: first section, first measure
      const firstSection = sections[0];
      const firstIdx = getSectionStartIndex(song, firstSection);
      setStartSection(firstSection);
      setStartMeasureIdx(firstIdx);
      // Default end: last measure of the first section
      const measuresInFirst = getMeasuresInSection(song, firstSection);
      const lastMeasure = measuresInFirst[measuresInFirst.length - 1];
      const lastIdx = song.measures.indexOf(lastMeasure);
      setEndSection(firstSection);
      setEndMeasureIdx(lastIdx >= 0 ? lastIdx : firstIdx);
      setCountInEnabled(false);
    }
    setIsInitialized(true);
  }

  // Reset initialization when modal closes
  if (!isOpen && isInitialized) {
    setIsInitialized(false);
  }

  const startMeasureOptions = useMemo(() => {
    if (!song || !startSection) return [];
    const measures = getMeasuresInSection(song, startSection);
    return measures.map(m => ({
      label: String(m.sectionMeasure ?? m.measure),
      absoluteLabel: String(m.measure),
      arrayIndex: song.measures.indexOf(m),
    }));
  }, [song, startSection]);

  const endMeasureOptions = useMemo(() => {
    if (!song || !endSection) return [];
    const measures = getMeasuresInSection(song, endSection);
    return measures.map(m => ({
      label: String(m.sectionMeasure ?? m.measure),
      absoluteLabel: String(m.measure),
      arrayIndex: song.measures.indexOf(m),
    }));
  }, [song, endSection]);

  const handleStartSectionChange = (section: string) => {
    if (!song) return;
    setStartSection(section);
    const idx = getSectionStartIndex(song, section);
    setStartMeasureIdx(idx);
  };

  const handleEndSectionChange = (section: string) => {
    if (!song) return;
    setEndSection(section);
    // Set to last measure of section by default
    const measures = getMeasuresInSection(song, section);
    const lastMeasure = measures[measures.length - 1];
    const lastIdx = song.measures.indexOf(lastMeasure);
    setEndMeasureIdx(lastIdx >= 0 ? lastIdx : getSectionStartIndex(song, section));
  };

  const isValid = song && startMeasureIdx <= endMeasureIdx;

  const handleApply = () => {
    if (!isValid) return;
    onSetRepeat(startMeasureIdx, endMeasureIdx, countInEnabled);
    onClose();
  };

  const handleClear = () => {
    onClearRepeat();
    onClose();
  };

  if (!isOpen || !song) return null;

  // Helper to format a measure range description
  const startMeasure = song.measures[startMeasureIdx];
  const endMeasure = song.measures[endMeasureIdx];

  return (
    <div className="repeat-modal-backdrop" onClick={onClose}>
      <div className="repeat-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="repeat-modal-header">
          <h2 className="repeat-modal-title">🔁 リピート設定</h2>
          <button
            className="repeat-modal-close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="repeat-modal-content">
          {/* Start position */}
          <div className="repeat-modal-section">
            <h3 className="repeat-modal-section-title">開始地点</h3>
            <div className="repeat-modal-position-row">
              <div className="repeat-modal-field">
                <label className="repeat-modal-field-label" htmlFor="repeat-start-section">
                  練習番号
                </label>
                <select
                  id="repeat-start-section"
                  className="repeat-modal-select"
                  value={startSection}
                  onChange={(e) => handleStartSectionChange(e.target.value)}
                >
                  {sections.map(s => (
                    <option key={s} value={s}>{s.trim() || '(intro)'}</option>
                  ))}
                </select>
              </div>
              <div className="repeat-modal-field">
                <label className="repeat-modal-field-label" htmlFor="repeat-start-measure">
                  小節
                </label>
                <select
                  id="repeat-start-measure"
                  className="repeat-modal-select"
                  value={startMeasureIdx}
                  onChange={(e) => setStartMeasureIdx(parseInt(e.target.value, 10))}
                >
                  {startMeasureOptions.map(opt => (
                    <option key={opt.arrayIndex} value={opt.arrayIndex}>
                      {opt.label}（通し{opt.absoluteLabel}）
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {startMeasure && (
              <div className="repeat-modal-preview">
                {startMeasure.section} - 小節{startMeasure.sectionMeasure ?? startMeasure.measure}
                （{startMeasure.numerator}/{startMeasure.denominator}、♩={startMeasure.target_bpm}）
              </div>
            )}
          </div>

          {/* End position */}
          <div className="repeat-modal-section">
            <h3 className="repeat-modal-section-title">終了地点</h3>
            <div className="repeat-modal-position-row">
              <div className="repeat-modal-field">
                <label className="repeat-modal-field-label" htmlFor="repeat-end-section">
                  練習番号
                </label>
                <select
                  id="repeat-end-section"
                  className="repeat-modal-select"
                  value={endSection}
                  onChange={(e) => handleEndSectionChange(e.target.value)}
                >
                  {sections.map(s => (
                    <option key={s} value={s}>{s.trim() || '(intro)'}</option>
                  ))}
                </select>
              </div>
              <div className="repeat-modal-field">
                <label className="repeat-modal-field-label" htmlFor="repeat-end-measure">
                  小節
                </label>
                <select
                  id="repeat-end-measure"
                  className="repeat-modal-select"
                  value={endMeasureIdx}
                  onChange={(e) => setEndMeasureIdx(parseInt(e.target.value, 10))}
                >
                  {endMeasureOptions.map(opt => (
                    <option key={opt.arrayIndex} value={opt.arrayIndex}>
                      {opt.label}（通し{opt.absoluteLabel}）
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {endMeasure && (
              <div className="repeat-modal-preview">
                {endMeasure.section} - 小節{endMeasure.sectionMeasure ?? endMeasure.measure}
                （{endMeasure.numerator}/{endMeasure.denominator}、♩={endMeasure.target_bpm}）
              </div>
            )}
          </div>

          {/* Validation error */}
          {!isValid && (
            <div className="repeat-modal-error">
              ⚠ 開始地点は終了地点より前に設定してください
            </div>
          )}

          {/* Count-in toggle */}
          <div className="repeat-modal-section">
            <div className="repeat-modal-countin-row">
              <div className="repeat-modal-countin-info">
                <h3 className="repeat-modal-section-title">戻る際のカウント</h3>
                <p className="repeat-modal-countin-desc">
                  リピート開始地点に戻る際に1小節分のカウントインを行います
                </p>
              </div>
              <button
                className={`repeat-modal-toggle ${countInEnabled ? 'repeat-modal-toggle-on' : ''}`}
                onClick={() => setCountInEnabled(!countInEnabled)}
                id="repeat-countin-toggle"
                aria-label={countInEnabled ? 'カウントをOFFにする' : 'カウントをONにする'}
              >
                <span className="repeat-modal-toggle-knob" />
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="repeat-modal-actions">
          {currentRepeat && (
            <button
              className="repeat-modal-clear-btn"
              onClick={handleClear}
              id="repeat-clear-button"
            >
              リピート解除
            </button>
          )}
          <button
            className="repeat-modal-apply-btn"
            onClick={handleApply}
            disabled={!isValid}
            id="repeat-apply-button"
          >
            設定する
          </button>
        </div>
      </div>
    </div>
  );
}
