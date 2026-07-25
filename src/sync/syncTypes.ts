/** Sync protocol type definitions */

/** Sync mode for the current device */
export type SyncMode = 'solo' | 'leader' | 'member';



/** Information about a connected member */
export interface MemberInfo {
  peerId: string;
  name?: string;
}

// ─── Sync Messages ────────────────────────────────────

/** Clock sync request (sent by member) */
export interface ClockSyncRequest {
  type: 'clock-sync-request';
  /** Member's local timestamp (performance.now()) when sent */
  t1: number;
}

/** Clock sync response (sent by leader) */
export interface ClockSyncResponse {
  type: 'clock-sync-response';
  /** Original t1 from the request */
  t1: number;
  /** Leader's local timestamp when received */
  t2: number;
  /** Leader's local timestamp when sent */
  t3: number;
}

/** Play command (sent by leader) */
export interface PlayMessage {
  type: 'play';
  /** Wall-clock time (performance.now() on leader) when playback should start */
  startTime: number;
  /** Measure index to start from */
  measureIndex: number;
  /** Beat index to start from */
  beatIndex: number;
  /** BPM at start */
  bpm: number;
}

/** Stop command (sent by leader) */
export interface StopMessage {
  type: 'stop';
}

/** Jump to measure command (sent by leader) */
export interface JumpMessage {
  type: 'jump';
  measureIndex: number;
}

/** Settings sync (sent by leader) */
export interface SettingsMessage {
  type: 'settings';
  bpm?: number;
  bpmMode?: 'fixed' | 'multiplier';
  multiplier?: number;
  subdivisionMode?: '8' | '16';
  soundMode?: 'synth' | 'wav';
  countInEnabled?: boolean;
}

/** Song data broadcast (sent by leader to new members or on song change) */
export interface SongDataMessage {
  type: 'song-data';
  songJson: string;
  songTitle: string;
}

/** Join request (sent by member) */
export interface JoinRequestMessage {
  type: 'join-request';
  name?: string;
}

/** Member list update (broadcast by leader) */
export interface MemberListMessage {
  type: 'member-list';
  members: MemberInfo[];
}

/** Welcome message (sent by leader to new member on connect) */
export interface WelcomeMessage {
  type: 'welcome';
  /** Current song data */
  songJson: string;
  songTitle: string;
  /** Current settings */
  bpm: number;
  bpmMode: 'fixed' | 'multiplier';
  multiplier: number;
  subdivisionMode: '8' | '16';
  soundMode: 'synth' | 'wav';
  countInEnabled: boolean;
  /** Current playback state */
  isPlaying: boolean;
  measureIndex: number;
  beatIndex: number;
}

/** Union of all sync messages */
export type SyncMessage =
  | ClockSyncRequest
  | ClockSyncResponse
  | PlayMessage
  | StopMessage
  | JumpMessage
  | SettingsMessage
  | SongDataMessage
  | JoinRequestMessage
  | MemberListMessage
  | WelcomeMessage;

// ─── Session State ────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SyncSessionState {
  mode: SyncMode;
  status: ConnectionStatus;
  roomCode: string | null;
  members: MemberInfo[];
  clockOffset: number;  // ms offset from leader's clock
  error: string | null;
}
