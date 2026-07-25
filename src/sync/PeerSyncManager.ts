import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type {
  SyncMessage,
  SyncMode,
  MemberInfo,
  ConnectionStatus,
  WelcomeMessage,
  PlayMessage,
  ClockSyncRequest,
  ClockSyncResponse,
} from './syncTypes';

/**
 * Room code prefix for PeerJS peer IDs.
 * Full peer ID = `${PREFIX}${roomCode}`
 */
const PEER_ID_PREFIX = 'metro-sync-';

/** How far in the future to schedule playback start (ms) */
const PLAY_DELAY = 500;

/** Generate a random 4-digit room code */
function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

type MessageHandler = (msg: SyncMessage, fromPeerId?: string) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type MembersHandler = (members: MemberInfo[]) => void;

/**
 * Manages PeerJS-based P2P sync for the metronome.
 *
 * Leader mode:
 *   - Creates a Peer with a known ID based on the room code
 *   - Accepts connections from members
 *   - Broadcasts play/stop/jump/settings/song commands
 *
 * Member mode:
 *   - Connects to the leader's Peer ID
 *   - Receives commands and syncs clock
 */
export class PeerSyncManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private mode: SyncMode = 'solo';
  private roomCode: string | null = null;
  private members: MemberInfo[] = [];

  // Clock sync
  private clockOffset = 0; // ms: leader's clock - my clock
  private clockSyncTimer: number | null = null;

  // Callbacks
  private onMessage: MessageHandler | null = null;
  private onStatus: StatusHandler | null = null;
  private onMembers: MembersHandler | null = null;

  /**
   * Register a callback for incoming sync messages.
   */
  setOnMessage(handler: MessageHandler): void {
    this.onMessage = handler;
  }

  /**
   * Register a callback for connection status changes.
   */
  setOnStatus(handler: StatusHandler): void {
    this.onStatus = handler;
  }

  /**
   * Register a callback for member list updates.
   */
  setOnMembers(handler: MembersHandler): void {
    this.onMembers = handler;
  }

  getMode(): SyncMode {
    return this.mode;
  }

  getRoomCode(): string | null {
    return this.roomCode;
  }

  getClockOffset(): number {
    return this.clockOffset;
  }

  getMembers(): MemberInfo[] {
    return [...this.members];
  }

  /**
   * Start as leader: create a Peer and wait for member connections.
   * Accepts an optional existing room code for session restoration.
   */
  async startAsLeader(existingCode?: string): Promise<string> {
    this.cleanup();
    this.mode = 'leader';
    this.roomCode = existingCode || generateRoomCode();
    this.members = [];
    this.clockOffset = 0; // Leader is the reference clock

    const peerId = PEER_ID_PREFIX + this.roomCode;

    return new Promise<string>((resolve, reject) => {
      this.emitStatus('connecting');

      this.peer = new Peer(peerId);

      this.peer.on('open', () => {
        this.emitStatus('connected');

        // Listen for incoming connections
        this.peer!.on('connection', (conn: DataConnection) => {
          this.handleLeaderConnection(conn);
        });

        resolve(this.roomCode!);
      });

      this.peer.on('error', (err) => {
        console.error('[SyncManager] Leader peer error:', err);
        // If the room code is taken and we didn't specify one, retry with a new one
        if (err.type === 'unavailable-id' && !existingCode) {
          this.peer?.destroy();
          this.roomCode = generateRoomCode();
          const newPeerId = PEER_ID_PREFIX + this.roomCode;
          this.peer = new Peer(newPeerId);
          this.peer.on('open', () => {
            this.emitStatus('connected');
            this.peer!.on('connection', (conn: DataConnection) => {
              this.handleLeaderConnection(conn);
            });
            resolve(this.roomCode!);
          });
          this.peer.on('error', (retryErr) => {
            this.emitStatus('error');
            reject(retryErr);
          });
        } else {
          this.emitStatus('error');
          reject(err);
        }
      });

      this.peer.on('disconnected', () => {
        this.peer?.reconnect();
      });
    });
  }

  /**
   * Join as member: connect to the leader's Peer.
   */
  async joinAsFollower(roomCode: string): Promise<void> {
    this.cleanup();
    this.mode = 'member';
    this.roomCode = roomCode;
    this.members = [];

    const leaderId = PEER_ID_PREFIX + roomCode;

    return new Promise<void>((resolve, reject) => {
      this.emitStatus('connecting');

      this.peer = new Peer();

      this.peer.on('open', () => {
        const conn = this.peer!.connect(leaderId, { reliable: true });

        conn.on('open', () => {
          this.connections.set(leaderId, conn);
          this.emitStatus('connected');

          // Send join request message
          this.sendToLeader({
            type: 'join-request',
          });

          // Start clock sync
          this.startClockSync(conn);

          resolve();
        });

        conn.on('data', (data: unknown) => {
          const msg = data as SyncMessage;
          this.handleMemberMessage(msg, conn);
        });

        conn.on('close', () => {
          this.connections.delete(leaderId);
          this.emitStatus('disconnected');
        });

        conn.on('error', (err) => {
          console.error('[SyncManager] Connection error:', err);
          this.emitStatus('error');
        });
      });

      this.peer.on('error', (err) => {
        console.error('[SyncManager] Member peer error:', err);
        this.emitStatus('error');
        reject(err);
      });
    });
  }



  /**
   * Broadcast a message to all connected peers.
   * Used by the leader to send commands.
   */
  broadcast(msg: SyncMessage): void {
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  /**
   * Create a play command with the appropriate future start time.
   * The leader calls this; it returns the wall-clock time for local use
   * and broadcasts the command.
   */
  broadcastPlay(measureIndex: number, beatIndex: number, bpm: number): number {
    const startTime = performance.now() + PLAY_DELAY;
    const msg: PlayMessage = {
      type: 'play',
      startTime,
      measureIndex,
      beatIndex,
      bpm,
    };
    this.broadcast(msg);
    return startTime;
  }

  /**
   * Convert a leader's wall-clock time to local wall-clock time.
   * Used by members to schedule playback.
   */
  leaderTimeToLocal(leaderTime: number): number {
    return leaderTime - this.clockOffset;
  }

  /**
   * Clean up all connections and destroy the peer.
   */
  cleanup(): void {
    if (this.clockSyncTimer !== null) {
      clearInterval(this.clockSyncTimer);
      this.clockSyncTimer = null;
    }
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    this.members = [];

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.mode = 'solo';
    this.roomCode = null;
    this.clockOffset = 0;
    this.clockSyncEntries = [];
    this.emitStatus('disconnected');
  }

  // ─── Private: Leader-side ─────────────────────────────

  /**
   * Handle a new incoming connection from a member (leader side).
   */
  private handleLeaderConnection(conn: DataConnection): void {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);

      conn.on('data', (data: unknown) => {
        const msg = data as SyncMessage;
        this.handleLeaderMessage(msg, conn);
      });

      conn.on('close', () => {
        this.connections.delete(conn.peer);
        this.members = this.members.filter(m => m.peerId !== conn.peer);
        this.broadcastMemberList();
        this.emitMembers();
      });
    });
  }

  /**
   * Handle messages received by the leader from a member.
   */
  private handleLeaderMessage(msg: SyncMessage, conn: DataConnection): void {
    switch (msg.type) {
      case 'join-request': {
        // Update or add member
        const existing = this.members.find(m => m.peerId === conn.peer);
        if (existing) {
          if (msg.name) existing.name = msg.name;
        } else {
          this.members.push({
            peerId: conn.peer,
            name: msg.name,
          });
        }
        this.broadcastMemberList();
        this.emitMembers();

        // Forward to App for welcome message
        if (this.onMessage) {
          this.onMessage(msg, conn.peer);
        }
        break;
      }

      case 'clock-sync-request': {
        // Respond with timestamps for clock offset calculation
        const response: ClockSyncResponse = {
          type: 'clock-sync-response',
          t1: msg.t1,
          t2: performance.now(),
          t3: performance.now(),
        };
        conn.send(response);
        break;
      }

      default:
        // Forward unknown messages to the app layer
        if (this.onMessage) {
          this.onMessage(msg, conn.peer);
        }
    }
  }

  /**
   * Broadcast the current member list to all connected peers.
   */
  private broadcastMemberList(): void {
    this.broadcast({
      type: 'member-list',
      members: this.members,
    });
  }

  /**
   * Send a welcome message to a specific member connection.
   * Called externally by the hook when it has the current state.
   */
  sendWelcome(peerId: string, welcome: WelcomeMessage): void {
    const conn = this.connections.get(peerId);
    if (conn?.open) {
      conn.send(welcome);
    }
  }

  // ─── Private: Member-side ─────────────────────────────

  /**
   * Handle messages received by a member from the leader.
   */
  private handleMemberMessage(msg: SyncMessage, _conn: DataConnection): void {
    switch (msg.type) {
      case 'clock-sync-response':
        this.handleClockSyncResponse(msg);
        break;

      default:
        // Forward to the app layer
        if (this.onMessage) {
          this.onMessage(msg);
        }
    }
  }

  /**
   * Send a message to the leader (member mode only).
   */
  private sendToLeader(msg: SyncMessage): void {
    if (!this.roomCode) return;
    const leaderId = PEER_ID_PREFIX + this.roomCode;
    const conn = this.connections.get(leaderId);
    if (conn?.open) {
      conn.send(msg);
    }
  }

  // ─── Clock Sync ───────────────────────────────────────

  /**
   * Start the clock sync protocol (member side).
   * Periodically pings the leader and computes the clock offset with RTT filtering.
   */
  private startClockSync(conn: DataConnection): void {
    if (this.clockSyncTimer !== null) {
      clearInterval(this.clockSyncTimer);
      this.clockSyncTimer = null;
    }

    const doSyncPing = () => {
      if (!conn.open) return;
      const request: ClockSyncRequest = {
        type: 'clock-sync-request',
        t1: performance.now(),
      };
      conn.send(request);
    };

    // Burst sync at start (10 pings, 100ms apart)
    let burstCount = 0;
    const burstInterval = window.setInterval(() => {
      doSyncPing();
      burstCount++;
      if (burstCount >= 10) {
        clearInterval(burstInterval);
      }
    }, 100);

    // Continuous periodic sync every 5 seconds
    this.clockSyncTimer = window.setInterval(() => {
      doSyncPing();
    }, 5000);
  }

  private clockSyncEntries: { offset: number; rtt: number }[] = [];

  /**
   * Handle a clock sync response (member side).
   * Computes the clock offset using NTP-style calculation with RTT filtering.
   */
  private handleClockSyncResponse(msg: ClockSyncResponse): void {
    const t4 = performance.now();
    const { t1, t2, t3 } = msg;

    // NTP RTT and offset formulas
    const rtt = (t4 - t1) - (t3 - t2);
    const offset = ((t2 - t1) + (t3 - t4)) / 2;

    this.clockSyncEntries.push({ offset, rtt });

    // Keep last 15 samples
    if (this.clockSyncEntries.length > 15) {
      this.clockSyncEntries.shift();
    }

    // Filter samples: take top 50% samples with lowest RTT to avoid network jitter
    const sortedByRtt = [...this.clockSyncEntries].sort((a, b) => a.rtt - b.rtt);
    const bestSamples = sortedByRtt.slice(0, Math.max(1, Math.floor(sortedByRtt.length / 2)));

    // Take median offset of the best RTT samples
    const offsets = bestSamples.map(s => s.offset).sort((a, b) => a - b);
    this.clockOffset = offsets[Math.floor(offsets.length / 2)];
  }

  // ─── Helpers ──────────────────────────────────────────

  private emitStatus(status: ConnectionStatus): void {
    if (this.onStatus) this.onStatus(status);
  }

  private emitMembers(): void {
    if (this.onMembers) this.onMembers([...this.members]);
  }
}
