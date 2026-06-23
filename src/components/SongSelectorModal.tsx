import { concour2026_1Song, concour2026_2Song } from '../data/sampleSong';
import type { SongData } from '../types/song';

interface SongSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (song: SongData) => void;
  currentSongTitle: string | null;
  onTriggerImport: () => void;
}

export function SongSelectorModal({
  isOpen,
  onClose,
  onSelectSong,
  currentSongTitle,
  onTriggerImport,
}: SongSelectorModalProps) {
  if (!isOpen) return null;

  const presets = [
    {
      id: 'concour2026_1',
      title: '第一楽章',
      displayName: '第一楽章',
      song: concour2026_1Song,
      // description: '',
    },
    {
      id: 'concour2026_2',
      title: '第二楽章',
      displayName: '第二楽章',
      song: concour2026_2Song,
      // description: '',
    },
  ];

  const handleSelectPreset = (song: SongData) => {
    onSelectSong(song);
    onClose();
  };

  const handleImportClick = () => {
    onTriggerImport();
    onClose();
  };

  return (
    <div className="song-selector-backdrop" onClick={onClose}>
      <div className="song-selector-panel" onClick={(e) => e.stopPropagation()}>
        <div className="song-selector-header">
          <h2 className="song-selector-title">曲の選択</h2>
          <button
            className="song-selector-close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="song-selector-content">
          <div className="song-selector-section">
            <h3 className="song-selector-section-title">プリセット曲</h3>
            <div className="song-selector-list">
              {presets.map((preset) => {
                const isActive = currentSongTitle === preset.title;
                return (
                  <button
                    key={preset.id}
                    className={`song-selector-item ${isActive ? 'song-selector-item-active' : ''}`}
                    onClick={() => handleSelectPreset(preset.song)}
                  >
                    <div className="song-selector-item-info">
                      <span className="song-selector-item-title">{preset.displayName}</span>
                    </div>
                    {isActive && (
                      <span className="song-selector-item-active-badge">選択中</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="song-selector-divider" />

          <div className="song-selector-section">
            <h3 className="song-selector-section-title">ファイルから読み込み</h3>
            <button
              className="song-selector-import-btn"
              onClick={handleImportClick}
            >
              📂 JSONファイルをインポートする
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
