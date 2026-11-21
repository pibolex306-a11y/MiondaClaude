import { Play, Pause, X } from 'lucide-react';
import { usePlayer } from '@/hooks/usePlayer';

export function MiniPlayer() {
  const { trackId, title, artist, coverUrl, isPlaying, progress, duration, togglePlay, stop } = usePlayer();

  if (!trackId) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="glass border-t border-border-subtle px-3 py-2.5 flex items-center gap-3 animate-slide-up">
      {/* Portada */}
      {coverUrl ? (
        <img src={coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <span className="text-xs">🎵</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{title}</p>
        <p className="text-xs text-text-secondary truncate uppercase">{artist}</p>
        {/* Barra de progreso */}
        <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white pressable"
          aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={stop}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary pressable"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
