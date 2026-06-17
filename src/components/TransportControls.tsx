interface TransportControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export function TransportControls({ isPlaying, onTogglePlay }: TransportControlsProps) {
  return (
    <div className="transport-controls" id="transport-controls">
      <button
        className={`transport-btn ${isPlaying ? 'transport-btn-playing' : ''}`}
        onClick={onTogglePlay}
        id="play-stop-button"
        aria-label={isPlaying ? '停止' : '再生'}
      >
        {isPlaying ? (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="10" y="8" width="7" height="24" rx="2" fill="currentColor" />
            <rect x="23" y="8" width="7" height="24" rx="2" fill="currentColor" />
          </svg>
        ) : (
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M12 6L34 20L12 34V6Z" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
