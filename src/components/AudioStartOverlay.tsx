import { useState } from 'react';

interface AudioStartOverlayProps {
  onStart: () => Promise<void>;
}

export function AudioStartOverlay({ onStart }: AudioStartOverlayProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleStart = async () => {
    setIsActivating(true);
    try {
      await onStart();
      setTimeout(() => setIsDismissed(true), 300);
    } catch (e) {
      console.error('Failed to initialize audio:', e);
      setIsActivating(false);
    }
  };

  if (isDismissed) return null;

  return (
    <div
      className={`overlay-backdrop ${isActivating ? 'overlay-fade-out' : ''}`}
      onClick={handleStart}
    >
      <div className="overlay-content">
        <div className="overlay-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="2" opacity="0.5" />
            <path d="M32 24L58 40L32 56V24Z" fill="currentColor" />
          </svg>
        </div>
        <h2 className="overlay-title">タップして開始</h2>
        <p className="overlay-subtitle">Tap to activate audio</p>
      </div>
    </div>
  );
}
