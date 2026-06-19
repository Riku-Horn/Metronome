import { useState, useRef, useCallback } from 'react';

interface TempoControlProps {
  bpm: number;
  targetBpm: number | null;
  onBpmChange: (bpm: number) => void;
}

export function TempoControl({ bpm, targetBpm, onBpmChange }: TempoControlProps) {
  const [prevBpm, setPrevBpm] = useState(bpm);
  const [inputValue, setInputValue] = useState(String(bpm));
  const holdTimerRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  if (bpm !== prevBpm) {
    setPrevBpm(bpm);
    setInputValue(String(bpm));
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const val = parseInt(inputValue, 10);
    if (!isNaN(val) && val >= 20 && val <= 400) {
      onBpmChange(val);
    } else {
      setInputValue(String(bpm));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };

  const increment = useCallback((delta: number) => {
    onBpmChange(bpm + delta);
  }, [bpm, onBpmChange]);

  const startHold = (delta: number) => {
    increment(delta);
    holdTimerRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        increment(delta);
      }, 80);
    }, 400);
  };

  const stopHold = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const snapToTarget = () => {
    if (targetBpm !== null) {
      onBpmChange(targetBpm);
    }
  };

  return (
    <div className="tempo-control" id="tempo-control">
      <div className="tempo-control-header">
        <span className="tempo-control-label">BPM</span>
      </div>

      <div className="tempo-control-row">
        <button
          className="tempo-btn tempo-btn-minus"
          onMouseDown={() => startHold(-1)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={(e) => { e.preventDefault(); startHold(-1); }}
          onTouchEnd={stopHold}
          id="tempo-decrease"
          aria-label="テンポを下げる"
        >
          −
        </button>

        <input
          type="number"
          className="tempo-input"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          min="20"
          max="400"
          id="tempo-input"
          aria-label="BPM入力"
        />

        <button
          className="tempo-btn tempo-btn-plus"
          onMouseDown={() => startHold(1)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={(e) => { e.preventDefault(); startHold(1); }}
          onTouchEnd={stopHold}
          id="tempo-increase"
          aria-label="テンポを上げる"
        >
          +
        </button>
      </div>

      <input
        type="range"
        className="tempo-slider"
        min="20"
        max="300"
        value={bpm}
        onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
        id="tempo-slider"
        aria-label="テンポスライダー"
      />

      <button
        className="tempo-snap-btn"
        onClick={snapToTarget}
        id="snap-to-tempo"
        style={{
          visibility: targetBpm !== null && targetBpm !== bpm ? 'visible' : 'hidden',
          pointerEvents: targetBpm !== null && targetBpm !== bpm ? 'auto' : 'none',
        }}
      >
        IN TEMPO ({targetBpm ?? 120}) にスナップ
      </button>
    </div>
  );
}
