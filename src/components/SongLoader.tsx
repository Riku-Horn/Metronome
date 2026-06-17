import { useRef, useState } from 'react';
import type { SongData } from '../types/song';
import { parseSongJson } from '../utils/songParser';

interface SongLoaderProps {
  onSongLoaded: (song: SongData) => void;
  currentSongTitle: string | null;
}

export function SongLoader({ onSongLoaded, currentSongTitle }: SongLoaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const result = parseSongJson(text);
      if ('error' in result) {
        setError(result.error);
      } else {
        onSongLoaded(result);
      }
    } catch {
      setError('ファイルの読み込みに失敗しました');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="song-loader" id="song-loader">
      <div
        className={`song-loader-dropzone ${isDragging ? 'song-loader-dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="song-loader-input"
          id="file-input"
        />
        <div className="song-loader-icon">📂</div>
        <div className="song-loader-text">
          {currentSongTitle ? (
            <>
              <span className="song-loader-current">♪ {currentSongTitle}</span>
              <span className="song-loader-hint">タップして変更</span>
            </>
          ) : (
            <>
              <span className="song-loader-prompt">JSONファイルを読み込む</span>
              <span className="song-loader-hint">タップまたはドラッグ＆ドロップ</span>
            </>
          )}
        </div>
      </div>
      {error && <div className="song-loader-error">{error}</div>}
    </div>
  );
}
