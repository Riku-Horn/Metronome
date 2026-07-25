import { useState, useRef } from 'react';
import type { SyncMode, MemberInfo, ConnectionStatus } from '../sync/syncTypes';

interface SyncPanelProps {
  syncMode: SyncMode;
  connectionStatus: ConnectionStatus;
  roomCode: string | null;
  members: MemberInfo[];
  error: string | null;
  isLeader: boolean;
  isMember: boolean;

  latencyOffsetMs: number;
  onLatencyOffsetChange: (offsetMs: number) => void;

  onGoSolo: () => void;
  onStartAsLeader: (existingCode?: string) => Promise<void>;
  onJoinAsMember: (code: string) => Promise<void>;
  onDisconnect: () => void;
}

export function SyncPanel({
  syncMode,
  connectionStatus,
  roomCode,
  members,
  error,
  isLeader,
  isMember,
  latencyOffsetMs,
  onLatencyOffsetChange,
  onGoSolo,
  onStartAsLeader,
  onJoinAsMember,
  onDisconnect,
}: SyncPanelProps) {
  const [joinCode, setJoinCode] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'solo' | 'leader' | 'member'>('solo');
  const inputRef = useRef<HTMLInputElement>(null);

  const statusLabel = {
    disconnected: '未接続',
    connecting: '接続中…',
    connected: '接続済み',
    error: 'エラー',
  }[connectionStatus];

  const statusDotClass = {
    disconnected: 'sync-status-dot-off',
    connecting: 'sync-status-dot-connecting',
    connected: 'sync-status-dot-on',
    error: 'sync-status-dot-error',
  }[connectionStatus];

  const modeLabel = {
    solo: '個人練習',
    leader: 'パートリーダー',
    member: 'メンバー',
  }[syncMode];

  const handleJoin = () => {
    if (joinCode.length === 4) {
      onJoinAsMember(joinCode);
    }
  };

  const handleSelectSolo = () => {
    setSelectedTab('solo');
    onGoSolo();
  };

  const handleSelectLeader = () => {
    setSelectedTab('leader');
    onStartAsLeader();
  };

  const handleSelectMember = () => {
    setSelectedTab('member');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Compact header bar (always visible)
  const renderHeader = () => (
    <button
      className="sync-panel-header"
      onClick={() => setIsExpanded(!isExpanded)}
      id="sync-panel-toggle"
      aria-label="同期パネルを開閉"
    >
      <div className="sync-panel-header-left">
        <span className={`sync-status-dot ${statusDotClass}`} title={statusLabel} />
        <span className="sync-panel-mode-label">{modeLabel}</span>
        {syncMode !== 'solo' && connectionStatus === 'connected' && (
          <span className="sync-panel-room-badge">#{roomCode}</span>
        )}
        {syncMode === 'leader' && members.length > 0 && (
          <span className="sync-panel-member-count">
            メンバー {members.length}名
          </span>
        )}
      </div>
      <span className={`sync-panel-chevron ${isExpanded ? 'sync-panel-chevron-open' : ''}`}>
        ▼
      </span>
    </button>
  );

  // Mode selection (when in solo or disconnected)
  const renderModeSelector = () => {
    const currentTab = connectionStatus === 'connected' ? syncMode : selectedTab;
    return (
      <div className="sync-mode-selector">
        <button
          className={`sync-mode-btn ${currentTab === 'solo' ? 'sync-mode-btn-active' : ''}`}
          onClick={handleSelectSolo}
          id="sync-mode-solo"
        >
          <span className="sync-mode-name">個人練習</span>
        </button>
        <button
          className={`sync-mode-btn ${currentTab === 'leader' ? 'sync-mode-btn-active' : ''}`}
          onClick={handleSelectLeader}
          id="sync-mode-leader"
        >
          <span className="sync-mode-name">パートリーダー</span>
        </button>
        <button
          className={`sync-mode-btn ${currentTab === 'member' ? 'sync-mode-btn-active' : ''}`}
          onClick={handleSelectMember}
          id="sync-mode-member"
        >
          <span className="sync-mode-name">メンバー</span>
        </button>
      </div>
    );
  };

  // Room code display (leader)
  const renderLeaderPanel = () => (
    <div className="sync-leader-panel">
      <div className="sync-room-display">
        <span className="sync-room-label">ルームコード</span>
        <span className="sync-room-code" id="sync-room-code">{roomCode}</span>
        <span className="sync-room-hint">メンバーにこの4桁コードを伝えてください</span>
      </div>
      <div className="sync-member-status">
        <span>接続メンバー: <strong>{members.length} 名</strong></span>
      </div>
      <button
        className="sync-disconnect-btn"
        onClick={onDisconnect}
        id="sync-disconnect"
      >
        ルームを終了する
      </button>
    </div>
  );

  // Join panel (member)
  const renderJoinPanel = () => (
    <div className="sync-join-panel">
      {connectionStatus !== 'connected' ? (
        <div className="sync-join-input-row">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="4桁コード"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="sync-join-input"
            id="sync-join-code-input"
          />
          <button
            className="sync-join-btn"
            onClick={handleJoin}
            disabled={joinCode.length !== 4 || connectionStatus === 'connecting'}
            id="sync-join-button"
          >
            {connectionStatus === 'connecting' ? '接続中…' : '参加'}
          </button>
        </div>
      ) : (
        <div className="sync-connected-info">
          <span className="sync-connected-badge">✓ ルーム #{roomCode} に参加中</span>
          <button
            className="sync-disconnect-btn"
            onClick={onDisconnect}
            id="sync-member-disconnect"
          >
            退出する
          </button>
        </div>
      )}
    </div>
  );

  const renderLatencyAdjustment = () => (
    <div className="sync-latency-adjustment">
      <div className="sync-latency-header">
        <span className="sync-latency-title">音ズレ微調整（レイテンシ補正）</span>
        <span className="sync-latency-value">{latencyOffsetMs > 0 ? `+${latencyOffsetMs}` : latencyOffsetMs} ms</span>
      </div>
      <div className="sync-latency-controls">
        <button
          className="sync-latency-btn"
          onClick={() => onLatencyOffsetChange(Math.max(-200, latencyOffsetMs - 10))}
          title="10ms早く発音"
        >
          -10ms
        </button>
        <button
          className="sync-latency-btn"
          onClick={() => onLatencyOffsetChange(Math.max(-200, latencyOffsetMs - 2))}
          title="2ms早く発音"
        >
          -2ms
        </button>
        <input
          type="range"
          min="-200"
          max="200"
          step="1"
          value={latencyOffsetMs}
          onChange={(e) => onLatencyOffsetChange(Number(e.target.value))}
          className="sync-latency-slider"
        />
        <button
          className="sync-latency-btn"
          onClick={() => onLatencyOffsetChange(Math.min(200, latencyOffsetMs + 2))}
          title="2ms遅く発音"
        >
          +2ms
        </button>
        <button
          className="sync-latency-btn"
          onClick={() => onLatencyOffsetChange(Math.min(200, latencyOffsetMs + 10))}
          title="10ms遅く発音"
        >
          +10ms
        </button>
      </div>
      <span className="sync-latency-hint">※ スマホのスピーカー遅延に合わせて耳で聴きながら微調整できます</span>
    </div>
  );

  return (
    <div className="sync-panel" id="sync-panel">
      {renderHeader()}

      {isExpanded && (
        <div className="sync-panel-body">
          {/* Show mode selector when not connected */}
          {connectionStatus !== 'connected' && renderModeSelector()}

          {/* Leader panel */}
          {isLeader && connectionStatus !== 'disconnected' && renderLeaderPanel()}

          {/* Member join panel */}
          {(isMember || (connectionStatus !== 'connected' && selectedTab === 'member')) && !isLeader && (
            renderJoinPanel()
          )}

          {/* Latency Adjustment (available whenever connected) */}
          {(isLeader || isMember) && connectionStatus === 'connected' && (
            renderLatencyAdjustment()
          )}

          {/* Error display */}
          {error && (
            <div className="sync-error">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
