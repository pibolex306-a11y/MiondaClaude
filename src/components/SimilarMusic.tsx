import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Music, Pause, Play, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

type Recommendation = {
  title: string;
  artist_name: string;
  cover_url: string | null;
  preview_url: string | null;
  links: Record<string, string>;
};

type Props = {
  title?: string;
  profileId?: string;
  profileName?: string;
};

export function SimilarMusic({ title, profileId, profileName }: Props) {
  const { user, demoMode } = useAuth();
  const { play, trackId: playingTrackId, isPlaying } = usePlayer();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const resolvedTitle = title ?? (profileId && profileName ? `Música parecida a la de ${profileName}` : 'Música parecida a lo tuyo');

  const loadRecommendations = useCallback(async () => {
    if (!demoMode && !user) {
      setLoading(false);
      setMessage('Inicia sesión y agrega canciones favoritas para recibir recomendaciones.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const { data, error: functionError } = await supabase.functions.invoke('lastfm-recommendations', {
      body: { targetProfileId: profileId },
    });
    setLoading(false);
    if (functionError || !Array.isArray(data?.recommendations)) {
      setError('Last.fm no está disponible en este momento. Intenta de nuevo más tarde.');
      return;
    }
    setRecommendations(data.recommendations as Recommendation[]);
    setMessage(typeof data.message === 'string' ? data.message : null);
  }, [user, demoMode, profileId]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  return (
    <section className="px-4 py-5 bg-bg-surface border border-border-subtle rounded-card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
            <Music size={18} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold font-heading truncate">{resolvedTitle}</h2>
            <p className="text-xs text-text-secondary">Basado en favoritos y Last.fm.</p>
          </div>
        </div>
        <button onClick={() => void loadRecommendations()} className="p-2 text-text-muted hover:text-text-primary pressable rounded-lg flex-shrink-0" aria-label="Actualizar recomendaciones">
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><div className="h-16 rounded-button skeleton" /><div className="h-16 rounded-button skeleton" /></div>}
      {!loading && error && <EmptyState title="No pudimos cargar recomendaciones" description={error} action={<Button size="sm" variant="secondary" onClick={() => void loadRecommendations()}>Reintentar</Button>} />}
      {!loading && !error && message && recommendations.length === 0 && <p className="text-sm text-text-secondary">{message}</p>}
      {!loading && !error && recommendations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {recommendations.map((recommendation) => {
            const trackId = `${recommendation.artist_name}::${recommendation.title}`;
            const isCurrentTrackPlaying = playingTrackId === trackId && isPlaying;
            const externalUrl = recommendation.links.lastfm || recommendation.links.itunes;
            return (
              <div key={trackId} className="flex items-center gap-2 p-2 bg-bg-elevated rounded-button border border-border-subtle min-w-0">
                {recommendation.cover_url ? <img src={recommendation.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" loading="lazy" /> : <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center flex-shrink-0"><Music size={16} className="text-text-muted" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{recommendation.title}</p>
                  <p className="text-xs text-text-secondary truncate">{recommendation.artist_name}</p>
                </div>
                {recommendation.preview_url && <button onClick={() => play(trackId, recommendation.title, recommendation.artist_name, recommendation.cover_url, recommendation.preview_url)} className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center pressable flex-shrink-0 transition-transform duration-150" aria-label={isCurrentTrackPlaying ? 'Pausar' : 'Reproducir'}>{isCurrentTrackPlaying ? <Pause size={14} /> : <Play size={14} />}</button>}
                {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-bg-hover text-text-secondary hover:text-text-primary flex items-center justify-center pressable flex-shrink-0" aria-label="Ver en Last.fm o iTunes"><ExternalLink size={14} /></a>}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-text-muted mt-3">
        Datos de{' '}
        <a href="https://www.last.fm" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">
          Last.fm <ExternalLink size={11} className="inline" />
        </a>
      </p>
    </section>
  );
}
