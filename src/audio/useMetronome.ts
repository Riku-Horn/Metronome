import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine } from './AudioEngine';
import { computeSectionMeasures } from '../utils/songParser';
import type { SongData, BeatEvent, PlaybackPosition } from '../types/song';

interface UseMetronomeReturn {
  /** Whether the metronome is currently playing */
  isPlaying: boolean;
  /** Current BPM */
  bpm: number;
  /** Current playback position */
  position: PlaybackPosition;
  /** Current beat event (for UI animation sync) */
  currentBeat: BeatEvent | null;
  /** Whether the AudioContext has been initialized */
  isInitialized: boolean;

  /** Initialize AudioContext (must be called from user gesture on iOS) */
  initialize: () => Promise<void>;
  /** Toggle play/stop */
  togglePlay: () => void;
  /** Start playing */
  play: () => void;
  /** Stop playing */
  stop: () => void;
  /** Set BPM */
  setBpm: (bpm: number) => void;
  /** Load song data */
  loadSong: (song: SongData) => void;
  /** Jump to a specific measure */
  jumpToMeasure: (measureIndex: number) => void;
  /** Current sound mode */
  soundMode: 'synth' | 'wav';
  /** Set sound mode */
  setSoundMode: (mode: 'synth' | 'wav') => void;
}

export function useMetronome(initialBpm = 120): UseMetronomeReturn {
  const engineRef = useRef<AudioEngine | null>(null);
  const songRef = useRef<SongData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(initialBpm);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<BeatEvent | null>(null);
  const [position, setPosition] = useState<PlaybackPosition>({
    measureIndex: 0,
    beatIndex: 0,
    isPlaying: false,
  });
  const [soundMode, setSoundModeState] = useState<'synth' | 'wav'>('synth');

  // Create engine on mount
  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;

    engine.setOnBeat((event: BeatEvent) => {
      setCurrentBeat(event);
      setPosition({
        measureIndex: event.measureIndex,
        beatIndex: event.beatIndex,
        isPlaying: true,
      });
    });

    engine.setOnMeasureChange((measureIndex: number) => {
      setPosition(prev => ({
        ...prev,
        measureIndex,
        beatIndex: 0,
      }));
      // Sync BPM state with engine (auto-snapped to target_bpm)
      setBpmState(engine.getBpm());
    });

    return () => {
      engine.dispose();
    };
  }, []);

  const initialize = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.init();
      setIsInitialized(true);
    }
  }, []);

  const play = useCallback(async () => {
    if (engineRef.current) {
      if (!isInitialized) {
        await engineRef.current.init();
        setIsInitialized(true);
      }
      await engineRef.current.start();
      setIsPlaying(true);
      setPosition(prev => ({ ...prev, isPlaying: true }));
    }
  }, [isInitialized]);

  const stop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      setIsPlaying(false);
      setCurrentBeat(null);
      setPosition(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  }, [isPlaying, play, stop]);

  const setBpm = useCallback((newBpm: number) => {
    const clampedBpm = Math.max(20, Math.min(400, newBpm));
    setBpmState(clampedBpm);
    if (engineRef.current) {
      engineRef.current.setBpm(clampedBpm);
    }
  }, []);

  const loadSong = useCallback((song: SongData) => {
    songRef.current = song;
    if (engineRef.current) {
      // Ensure sectionMeasure is computed (handles sampleSong and other direct data)
      computeSectionMeasures(song.measures);
      engineRef.current.setMeasures(song.measures);
      // Reset position
      setPosition({ measureIndex: 0, beatIndex: 0, isPlaying: false });
      setCurrentBeat(null);
      // Default BPM to first measure's target BPM (in-tempo)
      if (song.measures.length > 0) {
        const targetBpm = song.measures[0].target_bpm;
        setBpmState(targetBpm);
        engineRef.current.setBpm(targetBpm);
      }
    }
  }, []);

  const jumpToMeasure = useCallback((measureIndex: number) => {
    if (engineRef.current) {
      engineRef.current.jumpTo(measureIndex);
      setPosition(prev => ({
        ...prev,
        measureIndex,
        beatIndex: 0,
      }));
      setCurrentBeat(null);
      // Set BPM to jumped-to measure's target BPM (in-tempo)
      const song = songRef.current;
      if (song && measureIndex >= 0 && measureIndex < song.measures.length) {
        const targetBpm = song.measures[measureIndex].target_bpm;
        setBpmState(targetBpm);
        engineRef.current.setBpm(targetBpm);
      }
    }
  }, []);

  const setSoundMode = useCallback(async (mode: 'synth' | 'wav') => {
    setSoundModeState(mode);
    if (engineRef.current) {
      engineRef.current.setSoundMode(mode);
      if (mode === 'wav' && isInitialized) {
        await engineRef.current.init();
      }
    }
  }, [isInitialized]);

  return {
    isPlaying,
    bpm,
    position,
    currentBeat,
    isInitialized,
    initialize,
    togglePlay,
    play,
    stop,
    setBpm,
    loadSong,
    jumpToMeasure,
    soundMode,
    setSoundMode,
  };
}
