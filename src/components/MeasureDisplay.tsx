import type { MeasureData } from '../types/song';

interface MeasureDisplayProps {
  currentMeasure: MeasureData | null;
  bpm: number;
}

export function MeasureDisplay({ currentMeasure, bpm }: MeasureDisplayProps) {
  if (!currentMeasure) {
    return (
      <div className="measure-display" id="measure-display">
        <div className="measure-display-empty">曲データを読み込んでください</div>
      </div>
    );
  }

  return (
    <div className="measure-display" id="measure-display">
      <div className="measure-info-row">
        {/* Section */}
        <div className="measure-info-block">
          <span className="measure-label">Section</span>
          <span className="measure-value section-value">{currentMeasure.section.trim() || '(intro)'}</span>
        </div>

        {/* Time Signature */}
        <div className="measure-info-block">
          <span className="measure-label">拍子</span>
          <div className="time-signature">
            <span className="ts-numerator">{currentMeasure.numerator}</span>
            <span className="ts-divider">/</span>
            <span className="ts-denominator">{currentMeasure.denominator}</span>
          </div>
        </div>

        {/* Measure Number */}
        <div className="measure-info-block">
          <span className="measure-label">小節</span>
          <span className="measure-value">{currentMeasure.measure}</span>
        </div>
      </div>

      {/* Target Tempo / Current Tempo */}
      <div className="tempo-comparison">
        <div className="tempo-target">
          <span className="tempo-target-label">IN TEMPO</span>
          <span className="tempo-target-value">{currentMeasure.target_bpm}</span>
        </div>
        <div className="tempo-current-mini">
          <span className="tempo-current-label">CURRENT</span>
          <span className="tempo-current-value">{bpm}</span>
        </div>
      </div>
    </div>
  );
}
