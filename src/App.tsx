import { useState, useEffect, useCallback } from 'react';
import { useMetronome } from './audio/useMetronome';
import { AudioStartOverlay } from './components/AudioStartOverlay';
import { MeasureDisplay } from './components/MeasureDisplay';
import { BeatIndicator } from './components/BeatIndicator';
import { TransportControls } from './components/TransportControls';
import { TempoControl } from './components/TempoControl';
import { PositionSelector } from './components/PositionSelector';
import { SongLoader } from './components/SongLoader';
import { HelpPage } from './components/HelpPage';
import { sampleSong } from './data/sampleSong';
import { loadSongFromStorage, saveSongToStorage } from './utils/songParser';
import type { SongData } from './types/song';

function App() {
  const metronome = useMetronome(120);
  const [song, setSong] = useState<SongData>(() => {
    return loadSongFromStorage() || sampleSong;
  });
  const [showOverlay, setShowOverlay] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Load saved song or default sample on mount
  useEffect(() => {
    metronome.loadSong(song);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInitialize = useCallback(async () => {
    await metronome.initialize();
    setShowOverlay(false);
  }, [metronome]);

  const handleSongLoaded = useCallback((newSong: SongData) => {
    setSong(newSong);
    metronome.loadSong(newSong);
    metronome.stop();
    saveSongToStorage(newSong);
  }, [metronome]);

  const currentMeasure = song && song.measures.length > 0
    ? song.measures[metronome.position.measureIndex] || song.measures[0]
    : null;

  const targetBpm = currentMeasure?.target_bpm ?? null;

  return (
    <>
      {showOverlay && <AudioStartOverlay onStart={handleInitialize} />}
      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}

      <div className="app-container" id="app-container">
        {/* Header with song loader */}
        <div className="app-header">
          <div className="app-header-left">
            <span className="app-title">Metronome</span>
            <button
              className="help-btn"
              onClick={() => setShowHelp(true)}
              id="help-button"
              aria-label="ヘルプを表示"
            >
              ?
            </button>
          </div>
          <div className="app-header-right" id="app-header-right">
            <div className="sound-selector" id="sound-selector">
              <button
                className={`sound-btn ${metronome.soundMode === 'synth' ? 'active' : ''}`}
                onClick={() => metronome.setSoundMode('synth')}
                id="sound-synth-button"
                aria-label="電子音1に切り替え"
              >
                電子音1
              </button>
              <button
                className={`sound-btn ${metronome.soundMode === 'wav' ? 'active' : ''}`}
                onClick={() => metronome.setSoundMode('wav')}
                id="sound-wav-button"
                aria-label="電子音2に切り替え"
              >
                電子音2
              </button>
            </div>
            <div className="subdivision-selector" id="subdivision-selector">
              <button
                className={`subdivision-btn ${metronome.subdivisionMode === '8' ? 'active' : ''}`}
                onClick={() => metronome.setSubdivisionMode('8')}
                id="subdivision-8-button"
                aria-label="8分音符に切り替え"
              >
                8分
              </button>
              <button
                className={`subdivision-btn ${metronome.subdivisionMode === '16' ? 'active' : ''}`}
                onClick={() => metronome.setSubdivisionMode('16')}
                id="subdivision-16-button"
                aria-label="16分音符に切り替え"
              >
                16分
              </button>
            </div>
            <button
              className={`countin-toggle-btn ${metronome.countInEnabled ? 'active' : ''}`}
              onClick={() => metronome.setCountInEnabled(!metronome.countInEnabled)}
              id="countin-toggle-button"
              aria-label={metronome.countInEnabled ? 'カウントをOFFにする' : 'カウントをONにする'}
            >
              カウント{metronome.countInEnabled ? 'ON' : 'OFF'}
            </button>
            <SongLoader
              onSongLoaded={handleSongLoaded}
              currentSongTitle={song?.title || null}
            />
          </div>
        </div>

        {/* Top: Measure Info */}
        <div className="app-top">
          <MeasureDisplay
            currentMeasure={currentMeasure}
            bpm={metronome.bpm}
          />
        </div>

        {/* Center: Beat Indicator */}
        <div className="app-center">
          <BeatIndicator
            currentMeasure={currentMeasure}
            currentBeat={metronome.currentBeat}
            isPlaying={metronome.isPlaying}
            isCountIn={metronome.isCountIn}
            countInBeat={metronome.countInBeat}
            countInTotal={metronome.countInTotal}
          />
        </div>

        {/* Bottom: Controls */}
        <div className="app-bottom">
          <div className="app-controls-row">
            {/* Left: Position Selector */}
            <PositionSelector
              song={song}
              currentMeasureIndex={metronome.position.measureIndex}
              onJumpTo={metronome.jumpToMeasure}
            />

            {/* Center: Transport */}
            <TransportControls
              isPlaying={metronome.isPlaying}
              onTogglePlay={metronome.togglePlay}
            />

            {/* Right: Tempo Control */}
            <TempoControl
              bpm={metronome.bpm}
              targetBpm={targetBpm}
              onBpmChange={metronome.setBpm}
              bpmMode={metronome.bpmMode}
              onBpmModeChange={metronome.setBpmMode}
              multiplier={metronome.multiplier}
              onMultiplierChange={metronome.setMultiplier}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
