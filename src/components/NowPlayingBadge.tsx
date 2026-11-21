import { Radio } from 'lucide-react';
import type { NowPlayingInfo } from '@/hooks/useNowPlaying';
import { cn } from '@/lib/utils';

type Props = {
  info: NowPlayingInfo;
  compact?: boolean;
  className?: string;
};

// Indicador pequeño "Ahora suena" con portada, título y artista.
export function NowPlayingBadge({ info, compact, className }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/30 px-2 py-1.5',
        compact ? 'max-w-full' : '',
        className,
      )}
    >
      {info.cover_url ? (
        <img src={info.cover_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded bg-accent/20 flex items-center justify-center flex-shrink-0">
          <Radio size={14} className="text-accent" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-accent uppercase tracking-wide flex items-center gap-0.5">
            <Radio size={10} className="animate-pulse" />
            Ahora suena
          </span>
        </div>
        <p className="text-xs font-medium text-text-primary truncate">{info.title}</p>
        <p className="text-[11px] text-text-muted truncate">{info.artist}</p>
      </div>
    </div>
  );
}
