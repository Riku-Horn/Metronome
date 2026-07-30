import { useState, useEffect, useCallback } from 'react';
import { useMetronome } from './audio/useMetronome';
import { useSyncSession } from './sync/useSyncSession';
import { AudioStartOverlay } from './components/AudioStartOverlay';
import { MeasureDisplay } from './components/MeasureDisplay';
import { BeatIndicator } from './components/BeatIndicator';
import { TransportControls } from './components/TransportControls';
import { TempoControl } from './components/TempoControl';
import { PositionSelector } from './components/PositionSelector';
import { SongLoader } from './components/SongLoader';
import { SyncPanel } from './components/SyncPanel';
import { HelpPage } from './components/HelpPage';
import { RepeatSettingsModal } from './components/RepeatSettingsModal';
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
  const [showRepeatModal, setShowRepeatModal] = useState(false);

  // ─── Sync Session ──────────────────────────────────
  const sync = useSyncSession({
    engineRef: metronome.engineRef,
    song,
    isPlaying: metronome.isPlaying,
    bpm: metronome.bpm,
    bpmMode: metronome.bpmMode,
    multiplier: metronome.multiplier,
    subdivisionMode: metronome.subdivisionMode,
    soundMode: metronome.soundMode,
    countInEnabled: metronome.countInEnabled,
    measureIndex: metronome.position.measureIndex,
    beatIndex: metronome.position.beatIndex,
    onPlay: () => metronome.play(),
    onStop: () => metronome.stop(),
    onJump: (idx) => metronome.jumpToMeasure(idx),
    onSetBpm: (bpm) => metronome.setBpm(bpm),
    onSetBpmMode: (mode) => metronome.setBpmMode(mode),
    onSetMultiplier: (m) => metronome.setMultiplier(m),
    onSetSubdivisionMode: (mode) => metronome.setSubdivisionMode(mode),
    onSetSoundMode: (mode) => metronome.setSoundMode(mode),
    onSetCountInEnabled: (en) => metronome.setCountInEnabled(en),
    onLoadSong: (newSong) => {
      setSong(newSong);
      metronome.loadSong(newSong);
      saveSongToStorage(newSong);
    },
  });

  // Load saved song or default sample on mount
  useEffect(() => {
    metronome.loadSong(song);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInitialize = useCallback(async () => {
    await metronome.initialize();
    setShowOverlay(false);
  }, [metronome]);

  const getSyncManager = useCallback(() => {
    return (sync as unknown as { _manager: () => unknown })._manager() as import('./sync/PeerSyncManager').PeerSyncManager | null;
  }, [sync]);

  const handleSongLoaded = useCallback((newSong: SongData) => {
    if (sync.isMember) return; // Members cannot load songs

    setSong(newSong);
    metronome.loadSong(newSong);
    metronome.stop();
    saveSongToStorage(newSong);

    // If leader, broadcast song change to members
    if (sync.isLeader) {
      getSyncManager()?.broadcast({
        type: 'song-data',
        songJson: JSON.stringify(newSong.measures),
        songTitle: newSong.title,
      });
    }
  }, [metronome, sync, getSyncManager]);

  // ─── Sync-aware transport & setting controls ───────
  const handleTogglePlay = useCallback(() => {
    if (sync.isLeader) {
      // Leader: broadcast play/stop to all members
      const manager = getSyncManager();
      if (metronome.isPlaying) {
        metronome.stop();
        manager?.broadcast({ type: 'stop' });
      } else {
        // Schedule play slightly in the future for sync
        const startTime = manager?.broadcastPlay(
          metronome.position.measureIndex,
          metronome.position.beatIndex,
          metronome.bpm,
        );
        if (startTime !== undefined) {
          metronome.engineRef.current?.startAt(
            startTime,
            metronome.position.measureIndex,
            metronome.position.beatIndex,
          );
          // Manually set playing state since we bypassed play()
          metronome.play();
        } else {
          metronome.play();
        }
      }
    } else if (sync.isMember) {
      // Members cannot control playback
      return;
    } else {
      // Solo mode: normal toggle
      metronome.togglePlay();
    }
  }, [sync, metronome, getSyncManager]);

  const handleJumpTo = useCallback((measureIndex: number) => {
    if (sync.isMember) return; // Members cannot jump position

    metronome.jumpToMeasure(measureIndex);

    if (sync.isLeader) {
      getSyncManager()?.broadcast({ type: 'jump', measureIndex });
    }
  }, [metronome, sync, getSyncManager]);

  const handleBpmChange = useCallback((newBpm: number) => {
    if (sync.isMember) return; // Members cannot change BPM

    metronome.setBpm(newBpm);

    if (sync.isLeader) {
      getSyncManager()?.broadcast({ type: 'settings', bpm: newBpm });
    }
  }, [metronome, sync, getSyncManager]);

  const handleBpmModeChange = useCallback((mode: 'fixed' | 'multiplier') => {
    if (sync.isMember) return; // Members cannot change BPM mode

    metronome.setBpmMode(mode);

    if (sync.isLeader) {
      getSyncManager()?.broadcast({ type: 'settings', bpmMode: mode });
    }
  }, [metronome, sync, getSyncManager]);

  const handleMultiplierChange = useCallback((m: number) => {
    if (sync.isMember) return; // Members cannot change multiplier

    metronome.setMultiplier(m);

    if (sync.isLeader) {
      getSyncManager()?.broadcast({ type: 'settings', multiplier: m });
    }
  }, [metronome, sync, getSyncManager]);

  const handleSoundModeChange = useCallback((mode: 'synth' | 'wav') => {
    if (sync.isMember) return; // Members cannot change sound mode

    metronome.setSoundMode(mode);

    if (sync.isLeader) {
      getSyncManager()?.broadcast({ type: 'settings', soundMode: mode });
    }
  }, [metronome, sync, getSyncManager]);

  const handleSubdivisionModeChange = useCallback((mode: '8' | '16') => {
    if (sync.isMember) return; // Members cannot change subdivision mode

    metronome.setSubdivisionMode(mode);

    if (sync.isLeader) {
      getSyncManager()?.broadcast({ type: 'settings', subdivisionMode: mode });
    }
  }, [metronome, sync, getSyncManager]);

  const handleCountInToggle = useCallback((enabled: boolean) => {
    if (sync.isMember) return;
    metronome.setCountInEnabled(enabled);
    if (sync.isLeader) {
      getSyncManager()?.broadcast({ type: 'settings', countInEnabled: enabled });
    }
  }, [metronome, sync, getSyncManager]);

  const handleCountInModeChange = useCallback((mode: 'auto' | '3' | '4') => {
    if (sync.isMember) return;
    metronome.setCountInMode(mode);
    // Also ensure count-in is enabled when a mode is selected
    if (!metronome.countInEnabled) {
      metronome.setCountInEnabled(true);
      if (sync.isLeader) {
        getSyncManager()?.broadcast({ type: 'settings', countInEnabled: true });
      }
    }
  }, [metronome, sync, getSyncManager]);

  const currentMeasure = song && song.measures.length > 0
    ? song.measures[metronome.position.measureIndex] || song.measures[0]
    : null;

  const targetBpm = currentMeasure?.target_bpm ?? null;

  return (
    <>
      {showOverlay && <AudioStartOverlay onStart={handleInitialize} />}
      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
      <RepeatSettingsModal
        isOpen={showRepeatModal}
        onClose={() => setShowRepeatModal(false)}
        song={song}
        currentRepeat={metronome.repeatConfig}
        onSetRepeat={(startIndex, endIndex, countInMeasures, countInMode) => {
          metronome.setRepeatRange(startIndex, endIndex, countInMeasures, countInMode);
          handleJumpTo(startIndex);
        }}
        onClearRepeat={metronome.clearRepeatRange}
      />

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
                onClick={() => handleSoundModeChange('synth')}
                disabled={sync.isMember}
                id="sound-synth-button"
                aria-label="電子音1に切り替え"
              >
                電子音1
              </button>
              <button
                className={`sound-btn ${metronome.soundMode === 'wav' ? 'active' : ''}`}
                onClick={() => handleSoundModeChange('wav')}
                disabled={sync.isMember}
                id="sound-wav-button"
                aria-label="電子音2に切り替え"
              >
                電子音2
              </button>
            </div>
            <div className="subdivision-selector" id="subdivision-selector">
              <button
                className={`subdivision-btn ${metronome.subdivisionMode === '8' ? 'active' : ''}`}
                onClick={() => handleSubdivisionModeChange('8')}
                disabled={sync.isMember}
                id="subdivision-8-button"
                aria-label="8分音符に切り替え"
              >
                8分
              </button>
              <button
                className={`subdivision-btn ${metronome.subdivisionMode === '16' ? 'active' : ''}`}
                onClick={() => handleSubdivisionModeChange('16')}
                disabled={sync.isMember}
                id="subdivision-16-button"
                aria-label="16分音符に切り替え"
              >
                16分
              </button>
            </div>
            <div className="countin-mode-selector" id="countin-mode-selector">
              <button
                className={`countin-mode-btn ${!metronome.countInEnabled ? 'active' : ''}`}
                onClick={() => handleCountInToggle(false)}
                disabled={sync.isMember || !!metronome.repeatConfig}
                id="countin-off-button"
                title={metronome.repeatConfig ? 'リピート設定有効時はリピート設定が優先されます' : undefined}
              >
                カウントなし
              </button>
              <button
                className={`countin-mode-btn ${metronome.countInEnabled && metronome.countInMode === 'auto' ? 'active' : ''}`}
                onClick={() => handleCountInModeChange('auto')}
                disabled={sync.isMember || !!metronome.repeatConfig}
                id="countin-auto-button"
                title={metronome.repeatConfig ? 'リピート設定有効時はリピート設定が優先されます' : undefined}
              >
                開始小節と同じ
              </button>
              <button
                className={`countin-mode-btn ${metronome.countInEnabled && metronome.countInMode === '4' ? 'active' : ''}`}
                onClick={() => handleCountInModeChange('4')}
                disabled={sync.isMember || !!metronome.repeatConfig}
                id="countin-4-button"
                title={metronome.repeatConfig ? 'リピート設定有効時はリピート設定が優先されます' : undefined}
              >
                4拍
              </button>
              <button
                className={`countin-mode-btn ${metronome.countInEnabled && metronome.countInMode === '3' ? 'active' : ''}`}
                onClick={() => handleCountInModeChange('3')}
                disabled={sync.isMember || !!metronome.repeatConfig}
                id="countin-3-button"
                title={metronome.repeatConfig ? 'リピート設定有効時はリピート設定が優先されます' : undefined}
              >
                3拍
              </button>
            </div>
            <SongLoader
              onSongLoaded={handleSongLoaded}
              currentSongTitle={song?.title || null}
              disabled={sync.isMember}
            />
          </div>
        </div>

        {/* Sync Panel */}
        <SyncPanel
          syncMode={sync.syncMode}
          connectionStatus={sync.connectionStatus}
          roomCode={sync.roomCode}
          members={sync.members}
          error={sync.error}
          isLeader={sync.isLeader}
          isMember={sync.isMember}
          latencyOffsetMs={metronome.latencyOffsetMs}
          onLatencyOffsetChange={metronome.setLatencyOffsetMs}
          onGoSolo={sync.goSolo}
          onStartAsLeader={sync.startAsLeader}
          onJoinAsMember={sync.joinAsMember}
          onDisconnect={sync.disconnect}
        />

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
        <div className={`app-bottom ${sync.isMember ? 'member-disabled-controls' : ''}`}>
          <div className="app-controls-row">
            {/* Left: Position Selector + Repeat */}
            <div className="position-repeat-group">
              <PositionSelector
                song={song}
                currentMeasureIndex={metronome.position.measureIndex}
                onJumpTo={handleJumpTo}
              />
              <div className="repeat-control">
                <button
                  className={`repeat-btn ${metronome.repeatConfig ? 'repeat-btn-active' : ''}`}
                  onClick={() => setShowRepeatModal(true)}
                  id="repeat-button"
                  aria-label="リピート設定"
                  disabled={sync.isMember}
                >
                  🔁 リピート{metronome.repeatConfig ? 'ON' : ''}
                </button>
                {metronome.repeatConfig && song && (
                  <div className="repeat-indicator">
                    {song.measures[metronome.repeatConfig.startIndex]?.section}
                    {song.measures[metronome.repeatConfig.startIndex]?.sectionMeasure ?? ''}
                    {'→'}
                    {song.measures[metronome.repeatConfig.endIndex]?.section}
                    {song.measures[metronome.repeatConfig.endIndex]?.sectionMeasure ?? ''}
                  </div>
                )}
              </div>
            </div>

            {/* Center: Transport */}
            <TransportControls
              isPlaying={metronome.isPlaying}
              onTogglePlay={handleTogglePlay}
            />

            {/* Right: Tempo Control */}
            <TempoControl
              bpm={metronome.bpm}
              targetBpm={targetBpm}
              onBpmChange={handleBpmChange}
              bpmMode={metronome.bpmMode}
              onBpmModeChange={handleBpmModeChange}
              multiplier={metronome.multiplier}
              onMultiplierChange={handleMultiplierChange}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
