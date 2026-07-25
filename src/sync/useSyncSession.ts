import { useState, useRef, useCallback, useEffect } from 'react';
import { PeerSyncManager } from './PeerSyncManager';
import { parseSongJson } from '../utils/songParser';
import type { AudioEngine } from '../audio/AudioEngine';
import type {
  SyncMode,
  MemberInfo,
  ConnectionStatus,
  SyncMessage,
  WelcomeMessage,
} from './syncTypes';
import type { SongData } from '../types/song';

interface UseSyncSessionOptions {
  /** Reference to the AudioEngine instance */
  engineRef: React.RefObject<AudioEngine | null>;
  /** Current song data */
  song: SongData | null;
  /** Current playback state */
  isPlaying: boolean;
  /** Current BPM */
  bpm: number;
  bpmMode: 'fixed' | 'multiplier';
  multiplier: number;
  subdivisionMode: '8' | '16';
  soundMode: 'synth' | 'wav';
  countInEnabled: boolean;
  /** Current position */
  measureIndex: number;
  beatIndex: number;
  /** Callbacks to control the metronome */
  onPlay: () => void;
  onStop: () => void;
  onJump: (measureIndex: number) => void;
  onSetBpm: (bpm: number) => void;
  onSetBpmMode: (mode: 'fixed' | 'multiplier') => void;
  onSetMultiplier: (m: number) => void;
  onSetSubdivisionMode: (mode: '8' | '16') => void;
  onSetSoundMode: (mode: 'synth' | 'wav') => void;
  onSetCountInEnabled: (enabled: boolean) => void;
  onLoadSong: (song: SongData) => void;
}

interface UseSyncSessionReturn {
  /** Current sync mode */
  syncMode: SyncMode;
  /** Connection status */
  connectionStatus: ConnectionStatus;
  /** Room code (leader: generated, member: entered) */
  roomCode: string | null;
  /** Connected members (leader only) */
  members: MemberInfo[];
  /** Error message */
  error: string | null;

  /** Switch to solo mode */
  goSolo: () => void;
  /** Start as part leader */
  startAsLeader: (existingCode?: string) => Promise<void>;
  /** Join as member */
  joinAsMember: (code: string) => Promise<void>;
  /** Disconnect from current session */
  disconnect: () => void;

  /** Whether this device is leader (controls playback) */
  isLeader: boolean;
  /** Whether this device is a synced member */
  isMember: boolean;
}

/**
 * React hook for managing sync sessions.
 * Bridges the PeerSyncManager with the metronome's AudioEngine and UI state.
 */
export function useSyncSession(options: UseSyncSessionOptions): UseSyncSessionReturn {
  const {
    engineRef,
    song,
    isPlaying,
    bpm,
    bpmMode,
    multiplier,
    subdivisionMode,
    soundMode,
    countInEnabled,
    measureIndex,
    beatIndex,
    onPlay,
    onStop,
    onJump,
    onSetBpm,
    onSetBpmMode,
    onSetMultiplier,
    onSetSubdivisionMode,
    onSetSoundMode,
    onSetCountInEnabled,
    onLoadSong,
  } = options;

  const managerRef = useRef<PeerSyncManager | null>(null);

  const [syncMode, setSyncMode] = useState<SyncMode>('solo');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to current state for use in callbacks
  const stateRef = useRef({
    song, isPlaying, bpm, bpmMode, multiplier,
    subdivisionMode, soundMode, countInEnabled,
    measureIndex, beatIndex,
  });
  useEffect(() => {
    stateRef.current = {
      song, isPlaying, bpm, bpmMode, multiplier,
      subdivisionMode, soundMode, countInEnabled,
      measureIndex, beatIndex,
    };
  });

  // Initialize PeerSyncManager on mount
  useEffect(() => {
    const manager = new PeerSyncManager();
    managerRef.current = manager;

    manager.setOnStatus((status) => {
      setConnectionStatus(status);
    });

    manager.setOnMembers((memberList) => {
      setMembers(memberList);
    });

    return () => {
      manager.cleanup();
    };
  }, []);

  /**
   * Handle incoming sync messages.
   * This is set up when starting as leader or joining as member.
   */
  const handleMessage = useCallback((msg: SyncMessage, fromPeerId?: string) => {
    const manager = managerRef.current;
    if (!manager) return;

    switch (msg.type) {
      case 'play': {
        // Member: start playback at the specified wall-clock time
        const engine = engineRef.current;
        if (engine && !stateRef.current.isPlaying) {
          const localStartTime = manager.leaderTimeToLocal(msg.startTime);
          engine.startAt(localStartTime, msg.measureIndex, msg.beatIndex);
          // Let the parent know we're playing
          // We call onPlay after startAt so the UI updates
          onPlay();
        }
        break;
      }

      case 'stop': {
        onStop();
        break;
      }

      case 'jump': {
        onJump(msg.measureIndex);
        break;
      }

      case 'settings': {
        if (msg.bpm !== undefined) onSetBpm(msg.bpm);
        if (msg.bpmMode !== undefined) onSetBpmMode(msg.bpmMode);
        if (msg.multiplier !== undefined) onSetMultiplier(msg.multiplier);
        if (msg.subdivisionMode !== undefined) onSetSubdivisionMode(msg.subdivisionMode);
        if (msg.soundMode !== undefined) onSetSoundMode(msg.soundMode);
        if (msg.countInEnabled !== undefined) onSetCountInEnabled(msg.countInEnabled);
        break;
      }

      case 'song-data': {
        const result = parseSongJson(msg.songJson);
        if (!('error' in result)) {
          result.title = msg.songTitle;
          onLoadSong(result);
        }
        break;
      }

      case 'welcome': {
        // Member receives initial state from leader
        const welcome = msg as WelcomeMessage;

        // Load song data
        const result = parseSongJson(welcome.songJson);
        if (!('error' in result)) {
          result.title = welcome.songTitle;
          onLoadSong(result);
        }

        // Apply settings
        onSetBpm(welcome.bpm);
        onSetBpmMode(welcome.bpmMode);
        onSetMultiplier(welcome.multiplier);
        onSetSubdivisionMode(welcome.subdivisionMode);
        onSetSoundMode(welcome.soundMode);
        onSetCountInEnabled(welcome.countInEnabled);

        // Jump to current position
        if (welcome.measureIndex > 0) {
          onJump(welcome.measureIndex);
        }
        break;
      }

      case 'join-request': {
        // Leader: send welcome to new member
        if (manager.getMode() === 'leader' && fromPeerId && stateRef.current.song) {
          const s = stateRef.current;
          const welcome: WelcomeMessage = {
            type: 'welcome',
            songJson: JSON.stringify(s.song!.measures),
            songTitle: s.song!.title,
            bpm: s.bpm,
            bpmMode: s.bpmMode,
            multiplier: s.multiplier,
            subdivisionMode: s.subdivisionMode,
            soundMode: s.soundMode,
            countInEnabled: s.countInEnabled,
            isPlaying: s.isPlaying,
            measureIndex: s.measureIndex,
            beatIndex: s.beatIndex,
          };
          manager.sendWelcome(fromPeerId, welcome);
        }
        break;
      }

      case 'member-list': {
        setMembers(msg.members);
        break;
      }
    }
  }, [engineRef, onPlay, onStop, onJump, onSetBpm, onSetBpmMode, onSetMultiplier, onSetSubdivisionMode, onSetSoundMode, onSetCountInEnabled, onLoadSong]);

  const saveSession = (mode: SyncMode, code: string | null) => {
    try {
      if (mode === 'solo' || !code) {
        localStorage.removeItem('metronome_sync_session');
      } else {
        localStorage.setItem('metronome_sync_session', JSON.stringify({ mode, roomCode: code }));
      }
    } catch {
      // Ignore storage errors
    }
  };

  const goSolo = useCallback(() => {
    managerRef.current?.cleanup();
    setSyncMode('solo');
    setRoomCode(null);
    setMembers([]);
    setError(null);
    saveSession('solo', null);
  }, []);

  const startAsLeader = useCallback(async (existingCode?: string) => {
    const manager = managerRef.current;
    if (!manager) return;

    setError(null);
    manager.setOnMessage(handleMessage);

    try {
      const code = await manager.startAsLeader(existingCode);
      setSyncMode('leader');
      setRoomCode(code);
      saveSession('leader', code);
    } catch (err) {
      setError('ルームの作成・再開に失敗しました');
      console.error('[useSyncSession] Failed to start as leader:', err);
    }
  }, [handleMessage]);

  const joinAsMember = useCallback(async (code: string) => {
    const manager = managerRef.current;
    if (!manager) return;

    setError(null);
    manager.setOnMessage(handleMessage);

    try {
      await manager.joinAsFollower(code);
      setSyncMode('member');
      setRoomCode(code);
      saveSession('member', code);
    } catch (err) {
      setError('接続に失敗しました。コードを確認してください');
      console.error('[useSyncSession] Failed to join:', err);
    }
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    goSolo();
  }, [goSolo]);

  // Restore saved session or handle tab visibility reconnection
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const saved = localStorage.getItem('metronome_sync_session');
        if (saved) {
          const { mode, roomCode: code } = JSON.parse(saved);
          if (code && mode === 'member') {
            await joinAsMember(code);
          } else if (code && mode === 'leader') {
            await startAsLeader(code);
          }
        }
      } catch {
        // Ignore restoration error
      }
    };

    restoreSession();

    // Auto-reconnect on visibility change if connection was lost
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const manager = managerRef.current;
        const saved = localStorage.getItem('metronome_sync_session');
        if (saved && manager) {
          try {
            const { mode, roomCode: code } = JSON.parse(saved);
            if (code && mode === 'member' && manager.getMode() === 'solo') {
              joinAsMember(code);
            } else if (code && mode === 'leader' && manager.getMode() === 'solo') {
              startAsLeader(code);
            }
          } catch {
            // Ignore error
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Leader: broadcast actions ────────────────────────

  /**
   * Get the sync manager for leader broadcasting.
   * Used by App.tsx to intercept play/stop/jump and broadcast.
   */
  const getManager = useCallback(() => managerRef.current, []);

  const returnValue: UseSyncSessionReturn & { _manager: () => PeerSyncManager | null } = {
    syncMode,
    connectionStatus,
    roomCode,
    members,
    error,
    goSolo,
    startAsLeader,
    joinAsMember,
    disconnect,
    isLeader: syncMode === 'leader',
    isMember: syncMode === 'member',
    _manager: getManager,
  };

  return returnValue;
}
