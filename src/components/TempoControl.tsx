import { useState, useRef, useCallback, useEffect } from 'react';

interface TempoControlProps {
  bpm: number;
  targetBpm: number | null;
  onBpmChange: (bpm: number) => void;
  bpmMode: 'fixed' | 'multiplier';
  onBpmModeChange: (mode: 'fixed' | 'multiplier') => void;
  multiplier: number;
  onMultiplierChange: (multiplier: number) => void;
}

export function TempoControl({
  bpm,
  targetBpm,
  onBpmChange,
  bpmMode,
  onBpmModeChange,
  multiplier,
  onMultiplierChange,
}: TempoControlProps) {
  const [prevBpm, setPrevBpm] = useState(bpm);
  const [inputValue, setInputValue] = useState(String(bpm));
  const holdTimerRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  const effectiveTargetBpm = targetBpm ?? 120;

  // Sync internal input value if external BPM changes
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
      onMultiplierChange(val / effectiveTargetBpm);
    } else {
      setInputValue(String(bpm));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };

  const changeBpm = useCallback((newBpm: number) => {
    const clampedBpm = Math.max(20, Math.min(400, newBpm));
    onBpmChange(clampedBpm);
    onMultiplierChange(clampedBpm / effectiveTargetBpm);
  }, [effectiveTargetBpm, onBpmChange, onMultiplierChange]);

  const startBpmHold = (delta: number) => {
    if (bpmMode !== 'fixed') return;
    changeBpm(bpm + delta);
    holdTimerRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        changeBpm(bpm + delta);
      }, 80);
    }, 400);
  };

  const stopBpmHold = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handleMultiplierChange = (val: number) => {
    const clampedM = Math.max(0.25, Math.min(3.0, val));
    onMultiplierChange(clampedM);
    onBpmChange(Math.round(effectiveTargetBpm * clampedM));
  };

  const handleMultiplierIncrement = (delta: number) => {
    if (bpmMode !== 'multiplier') return;
    const newMultiplier = Math.max(0.25, Math.min(3.0, parseFloat((multiplier + delta).toFixed(2))));
    handleMultiplierChange(newMultiplier);
  };

  const snapToTarget = () => {
    if (targetBpm !== null) {
      onMultiplierChange(1.00);
      onBpmChange(targetBpm);
      onBpmModeChange('multiplier');
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
      if (holdIntervalRef.current !== null) clearInterval(holdIntervalRef.current);
    };
  }, []);

  return (
    <div className="tempo-control" id="tempo-control">
      {/* 1. BPM CONTROL PANEL */}
      <div 
        className={`tempo-panel bpm-panel ${bpmMode === 'fixed' ? 'panel-active' : 'panel-inactive'}`}
        id="bpm-control-panel"
      >
        {bpmMode !== 'fixed' && (
          <div 
            className="panel-overlay" 
            onClick={() => onBpmModeChange('fixed')}
            title="クリックしてBPM固定モードに切り替え"
            aria-label="クリックしてBPM固定モードに切り替え"
          />
        )}
        
        <div className="tempo-panel-header-compact">
          <span className="tempo-control-label">
            BPM {bpmMode === 'fixed' ? '（固定中）' : '（自動）'}
          </span>
        </div>

        <div className="tempo-panel-row-compact">
          <button
            className="tempo-btn-compact"
            onMouseDown={() => startBpmHold(-1)}
            onMouseUp={stopBpmHold}
            onMouseLeave={stopBpmHold}
            onTouchStart={(e) => { e.preventDefault(); startBpmHold(-1); }}
            onTouchEnd={stopBpmHold}
            id="tempo-decrease"
            aria-label="テンポを下げる"
            disabled={bpmMode !== 'fixed'}
          >
            −
          </button>

          <input
            type="range"
            className="tempo-slider bpm-slider"
            min="20"
            max="300"
            value={bpm}
            onChange={(e) => changeBpm(parseInt(e.target.value, 10))}
            id="tempo-slider"
            aria-label="テンポスライダー"
            disabled={bpmMode !== 'fixed'}
          />

          <button
            className="tempo-btn-compact"
            onMouseDown={() => startBpmHold(1)}
            onMouseUp={stopBpmHold}
            onMouseLeave={stopBpmHold}
            onTouchStart={(e) => { e.preventDefault(); startBpmHold(1); }}
            onTouchEnd={stopBpmHold}
            id="tempo-increase"
            aria-label="テンポを上げる"
            disabled={bpmMode !== 'fixed'}
          >
            +
          </button>

          <input
            type="number"
            className="tempo-input-compact"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            min="20"
            max="400"
            id="tempo-input"
            aria-label="BPM入力"
            disabled={bpmMode !== 'fixed'}
          />
        </div>
      </div>

      {/* 2. MULTIPLIER CONTROL PANEL */}
      <div 
        className={`tempo-panel multiplier-panel ${bpmMode === 'multiplier' ? 'panel-active' : 'panel-inactive'}`}
        id="multiplier-control-panel"
      >
        {bpmMode !== 'multiplier' && (
          <div 
            className="panel-overlay" 
            onClick={() => onBpmModeChange('multiplier')}
            title="クリックして倍率連動モードに切り替え"
            aria-label="クリックして倍率連動モードに切り替え"
          />
        )}

        <div className="tempo-panel-header-compact">
          <span className="tempo-control-label">
            倍率 {bpmMode === 'multiplier' ? '（操作可能）' : '（BPM固定中）'}
          </span>
        </div>

        <div className="tempo-panel-row-compact">
          <button
            className="tempo-btn-compact"
            onClick={() => handleMultiplierIncrement(-0.05)}
            id="multiplier-decrease"
            aria-label="倍率を下げる"
            disabled={bpmMode !== 'multiplier'}
          >
            −
          </button>

          <input
            type="range"
            className="tempo-slider multiplier-slider"
            min="0.25"
            max="1.50"
            step="0.01"
            value={multiplier}
            onChange={(e) => handleMultiplierChange(parseFloat(e.target.value))}
            id="multiplier-slider"
            aria-label="倍率スライダー"
            disabled={bpmMode !== 'multiplier'}
          />

          <button
            className="tempo-btn-compact"
            onClick={() => handleMultiplierIncrement(0.05)}
            id="multiplier-increase"
            aria-label="倍率を上げる"
            disabled={bpmMode !== 'multiplier'}
          >
            +
          </button>

          <div className="multiplier-value-display-compact" id="multiplier-value">
            {multiplier.toFixed(2)}x
          </div>
        </div>
      </div>

      {/* 3. SNAP BUTTON */}
      <button
        className="tempo-snap-btn-compact"
        onClick={snapToTarget}
        id="snap-to-tempo"
        style={{
          visibility: targetBpm !== null && (bpmMode !== 'multiplier' || multiplier !== 1.00) ? 'visible' : 'hidden',
          pointerEvents: targetBpm !== null && (bpmMode !== 'multiplier' || multiplier !== 1.00) ? 'auto' : 'none',
        }}
      >
        IN TEMPO ({effectiveTargetBpm}) にスナップ
      </button>
    </div>
  );
}
