import { useState, useEffect, useCallback } from 'react';
import { useMetronome } from './audio/useMetronome';
import { AudioStartOverlay } from './components/AudioStartOverlay';
import { MeasureDisplay } from './components/MeasureDisplay';
import { BeatIndicator } from './components/BeatIndicator';
import { TransportControls } from './components/TransportControls';
import { TempoControl } from './components/TempoControl';
import { PositionSelector } from './components/PositionSelector';
import { SongLoader } from './components/SongLoader';
import { sampleSong } from './data/sampleSong';
import { loadSongFromStorage, saveSongToStorage } from './utils/songParser';
import type { SongData } from './types/song';

function App() {
  const metronome = useMetronome(120);
  const [song, setSong] = useState<SongData>(() => {
    return loadSongFromStorage() || sampleSong;
  });
  const [showOverlay, setShowOverlay] = useState(true);

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

      <div className="app-container" id="app-container">
        {/* Header with song loader */}
        <div className="app-header">
          <span className="app-title">Metronome</span>
          <SongLoader
            onSongLoaded={handleSongLoaded}
            currentSongTitle={song?.title || null}
          />
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
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
