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
  /** Whether we are in the count-in phase */
  isCountIn: boolean;
  /** Current count-in beat number (1-based, resets each measure) */
  countInBeat: number;
  /** Total count-in beats (across both measures) */
  countInTotal: number;

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
  /** Current BPM mode: fixed or multiplier */
  bpmMode: 'fixed' | 'multiplier';
  /** Current tempo multiplier/factor */
  multiplier: number;
  /** Set BPM mode */
  setBpmMode: (mode: 'fixed' | 'multiplier') => void;
  /** Set tempo multiplier */
  setMultiplier: (multiplier: number) => void;
  /** Current subdivision mode */
  subdivisionMode: '8' | '16';
  /** Set subdivision mode */
  setSubdivisionMode: (mode: '8' | '16') => void;
  /** Whether count-in is enabled */
  countInEnabled: boolean;
  /** Toggle count-in on/off */
  setCountInEnabled: (enabled: boolean) => void;
  /** User manual latency offset in milliseconds */
  latencyOffsetMs: number;
  /** Set user manual latency offset */
  setLatencyOffsetMs: (offsetMs: number) => void;
  /** Direct reference to the AudioEngine (for sync layer) */
  engineRef: React.RefObject<AudioEngine | null>;
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
  const [bpmMode, setBpmModeState] = useState<'fixed' | 'multiplier'>('multiplier');
  const [multiplier, setMultiplierState] = useState(1.00);
  const [subdivisionMode, setSubdivisionModeState] = useState<'8' | '16'>('8');
  const [countInEnabled, setCountInEnabledState] = useState(true);
  const [isCountIn, setIsCountIn] = useState(false);
  const [countInBeat, setCountInBeat] = useState(0);
  const [countInTotal, setCountInTotal] = useState(0);

  // Create engine on mount
  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    engine.setBpmMode('multiplier');
    engine.setMultiplier(1.00);

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

    engine.setOnCountInBeat((beatNumber: number, totalBeats: number) => {
      setIsCountIn(true);
      setCountInBeat(beatNumber);
      setCountInTotal(totalBeats);
    });

    engine.setOnCountInEnd(() => {
      setIsCountIn(false);
      setCountInBeat(0);
      setCountInTotal(0);
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
      setIsCountIn(false);
      setCountInBeat(0);
      setCountInTotal(0);
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
        if (bpmMode === 'multiplier') {
          const newBpm = Math.max(20, Math.min(400, Math.round(targetBpm * multiplier)));
          setBpmState(newBpm);
          engineRef.current.setBpm(newBpm);
        } else {
          engineRef.current.setBpm(bpm);
        }
      }
    }
  }, [bpm, bpmMode, multiplier]);

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
        if (bpmMode === 'multiplier') {
          const newBpm = Math.max(20, Math.min(400, Math.round(targetBpm * multiplier)));
          setBpmState(newBpm);
          engineRef.current.setBpm(newBpm);
        } else {
          engineRef.current.setBpm(bpm);
        }
      }
    }
  }, [bpm, bpmMode, multiplier]);

  const setSoundMode = useCallback(async (mode: 'synth' | 'wav') => {
    setSoundModeState(mode);
    if (engineRef.current) {
      engineRef.current.setSoundMode(mode);
      if (mode === 'wav' && isInitialized) {
        await engineRef.current.init();
      }
    }
  }, [isInitialized]);

  const setBpmMode = useCallback((mode: 'fixed' | 'multiplier') => {
    setBpmModeState(mode);
    if (engineRef.current) {
      engineRef.current.setBpmMode(mode);
      if (mode === 'multiplier' && songRef.current) {
        const idx = Math.min(position.measureIndex, songRef.current.measures.length - 1);
        const targetBpm = songRef.current.measures[idx]?.target_bpm ?? 120;
        const newBpm = Math.max(20, Math.min(400, Math.round(targetBpm * multiplier)));
        setBpmState(newBpm);
        engineRef.current.setBpm(newBpm);
      } else {
        engineRef.current.setBpm(bpm);
      }
    }
  }, [multiplier, position.measureIndex, bpm]);

  const setMultiplier = useCallback((m: number) => {
    const clampedM = Math.max(0.25, Math.min(3.0, parseFloat(m.toFixed(2))));
    setMultiplierState(clampedM);
    if (engineRef.current) {
      engineRef.current.setMultiplier(clampedM);
      if (bpmMode === 'multiplier' && songRef.current) {
        const idx = Math.min(position.measureIndex, songRef.current.measures.length - 1);
        const targetBpm = songRef.current.measures[idx]?.target_bpm ?? 120;
        const newBpm = Math.max(20, Math.min(400, Math.round(targetBpm * clampedM)));
        setBpmState(newBpm);
        engineRef.current.setBpm(newBpm);
      }
    }
  }, [bpmMode, position.measureIndex]);

  const setSubdivisionMode = useCallback((mode: '8' | '16') => {
    setSubdivisionModeState(mode);
    if (engineRef.current) {
      engineRef.current.setSubdivisionMode(mode);
    }
  }, []);

  const [latencyOffsetMs, setLatencyOffsetMsState] = useState(0);

  const setCountInEnabled = useCallback((enabled: boolean) => {
    setCountInEnabledState(enabled);
    if (engineRef.current) {
      engineRef.current.setCountInEnabled(enabled);
    }
  }, []);

  const setLatencyOffsetMs = useCallback((offsetMs: number) => {
    setLatencyOffsetMsState(offsetMs);
    if (engineRef.current) {
      engineRef.current.setLatencyOffsetMs(offsetMs);
    }
  }, []);

  return {
    isPlaying,
    bpm,
    position,
    currentBeat,
    isInitialized,
    isCountIn,
    countInBeat,
    countInTotal,
    initialize,
    togglePlay,
    play,
    stop,
    setBpm,
    loadSong,
    jumpToMeasure,
    soundMode,
    setSoundMode,
    bpmMode,
    multiplier,
    setBpmMode,
    setMultiplier,
    subdivisionMode,
    setSubdivisionMode,
    countInEnabled,
    setCountInEnabled,
    latencyOffsetMs,
    setLatencyOffsetMs,
    engineRef,
  };
}
