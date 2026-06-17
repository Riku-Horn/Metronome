import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine } from './AudioEngine';
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
}

export function useMetronome(initialBpm = 120): UseMetronomeReturn {
  const engineRef = useRef<AudioEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(initialBpm);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<BeatEvent | null>(null);
  const [position, setPosition] = useState<PlaybackPosition>({
    measureIndex: 0,
    beatIndex: 0,
    isPlaying: false,
  });

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
    if (engineRef.current) {
      engineRef.current.setMeasures(song.measures);
      // Reset position
      setPosition({ measureIndex: 0, beatIndex: 0, isPlaying: false });
      setCurrentBeat(null);
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
    }
  }, []);

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
  };
}
