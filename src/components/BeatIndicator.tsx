import { useMemo } from 'react';
import type { MeasureData, BeatEvent } from '../types/song';
import { getBeatPattern } from '../utils/songParser';

interface BeatIndicatorProps {
  currentMeasure: MeasureData | null;
  currentBeat: BeatEvent | null;
  isPlaying: boolean;
  isCountIn?: boolean;
  countInBeat?: number;
  countInTotal?: number;
}

export function BeatIndicator({ currentMeasure, currentBeat, isPlaying, isCountIn, countInBeat, countInTotal: _countInTotal }: BeatIndicatorProps) {
  const pattern = useMemo(() => {
    if (!currentMeasure) return [];
    return getBeatPattern(currentMeasure);
  }, [currentMeasure]);

  // Determine grouping markers for visual separation
  const groupBoundaries = useMemo(() => {
    if (!currentMeasure) return new Set<number>();
    const boundaries = new Set<number>();

    if (currentMeasure.numerator === 7 && currentMeasure.denominator === 8) {
      // 2+2+3 grouping
      boundaries.add(2);
      boundaries.add(4);
    } else if (currentMeasure.denominator === 4) {
      // Group by quarter notes (every 2 eighth notes)
      for (let i = 2; i < pattern.length; i += 2) {
        boundaries.add(i);
      }
    }

    return boundaries;
  }, [currentMeasure, pattern.length]);

  // Compute the count-in display number (1-indexed within the measure)
  const countInDisplayNumber = isCountIn && countInBeat
    ? countInBeat
    : 0;

  if (!currentMeasure || pattern.length === 0) {
    return (
      <div className="beat-indicator" id="beat-indicator">
        <div className="beat-dots-container">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="beat-dot beat-dot-inactive" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="beat-indicator" id="beat-indicator">
      <div className="beat-dots-container" style={{ position: 'relative' }}>
        {pattern.map((type, index) => {
          const isActive = isPlaying && !isCountIn && currentBeat !== null && currentBeat.beatIndex === index;
          const isGroupStart = groupBoundaries.has(index);

          return (
            <div key={index} className="beat-dot-wrapper" style={isGroupStart ? { marginLeft: '12px' } : undefined}>
              <div
                className={[
                  'beat-dot',
                  type === 'A' ? 'beat-dot-accent' : 'beat-dot-sub',
                  isActive ? 'beat-dot-active' : '',
                  isActive && type === 'A' ? 'beat-dot-glow-accent' : '',
                  isActive && type === 'B' ? 'beat-dot-glow-sub' : '',
                ].filter(Boolean).join(' ')}
              />
              <span className="beat-dot-label">{type}</span>
            </div>
          );
        })}

        {/* Count-in overlay */}
        {isCountIn && countInBeat !== undefined && countInBeat > 0 && (
          <div className="count-in-overlay">
            <span className="count-in-number">{countInDisplayNumber}</span>
          </div>
        )}
      </div>

      {/* Pattern description */}
      {/* Pattern description */}
      <div className="beat-pattern-info">
        {currentMeasure.numerator}/{currentMeasure.denominator}
        {currentMeasure.numerator === 7 && currentMeasure.denominator === 8 && (
          <span className="beat-grouping"> (2+2+3)</span>
        )}
      </div>
    </div>
  );
}
