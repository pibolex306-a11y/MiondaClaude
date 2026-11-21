import { useState } from 'react';
import { Search as SearchIcon, Play, Pause, Plus, Music, Link2, Upload, History, ListMusic, Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

type SearchResult = {
  external_id: string;
  title: string;
  artist_name: string;
  album_title: string;
  cover_url: string | null;
  preview_url: string | null;
  duration_s: number | null;
  source: 'itunes' | 'manual';
  links: Record<string, string>;
};

export function Search() {
  const { user } = useAuth();
  const { trackId: playingTrackId, isPlaying, play } = usePlayer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectMode, setConnectMode] = useState<'link' | 'lastfm' | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [lastfmUsername, setLastfmUsername] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);

  async function searchMusic(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke('catalog-search', { body: { query } });
    setLoading(false);
    if (error || !data?.results) {
      setMessage('No se pudo buscar música. Intenta de nuevo.');
      return;
    }
    setResults(data.results as SearchResult[]);
    if (data.results.length === 0) setMessage('No encontramos canciones con esa búsqueda.');
  }

  async function resolveLink(event: React.FormEvent) {
    event.preventDefault();
    setConnectLoading(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke('link-resolver', { body: { url: linkUrl } });
    setConnectLoading(false);
    if (error || !data?.url) { setMessage(data?.error || 'No pudimos leer ese enlace.'); return; }
    if (!user) { setMessage('Enlace reconocido. Inicia sesión para guardarlo en tu perfil.'); return; }
    const { error: saveError } = await supabase.from('profile_embeds').insert({ profile_id: user.id, kind: data.kind || 'playlist', provider: data.provider, url: data.url, title: data.title, cover_url: data.cover_url, position: 0 });
    setMessage(saveError ? 'No se pudo guardar el enlace.' : 'Enlace agregado a tu perfil.');
    if (!saveError) { setLinkUrl(''); setConnectMode(null); }
  }

  async function importLastfm(event: React.FormEvent) {
    event.preventDefault();
    setConnectLoading(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke('lastfm-import', { body: { username: lastfmUsername, limit: 10 } });
    setConnectLoading(false);
    if (error || !data?.tracks) { setMessage(data?.error || 'No pudimos importar Last.fm.'); return; }
    const imported = data.tracks as SearchResult[];
    setResults(imported);
    setMessage(`${imported.length} canciones encontradas. Aplasta + para agregarlas.`);
    setConnectMode(null);
  }

  async function addToProfile(track: SearchResult) {
    if (!user) {
      setMessage('La vista previa permite explorar; inicia sesión para guardar canciones.');
      return;
    }
    const { data: saved, error: trackError } = await supabase
      .from('tracks')
      .upsert({ source: track.source, external_id: track.external_id, title: track.title, artist_name: track.artist_name, album_title: track.album_title, cover_url: track.cover_url, preview_url: track.preview_url, duration_s: track.duration_s, links: track.links }, { onConflict: 'source,external_id' })
      .select('id')
      .maybeSingle();
    if (trackError || !saved) {
      setMessage('No se pudo guardar la canción.');
      return;
    }
    const { error } = await supabase.from('profile_tracks').upsert({ profile_id: user.id, track_id: saved.id, kind: 'favorite', position: 0, added_via: 'buscar' }, { onConflict: 'profile_id,track_id,kind' });
    setMessage(error ? 'No se pudo agregar la canción.' : 'Canción agregada a tu perfil.');
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-32">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0"><Music size={20} className="text-accent" /></div>
            <div className="min-w-0"><h1 className="text-2xl font-bold font-heading truncate">Buscar música</h1><p className="text-sm text-text-secondary truncate">Encuentra canciones para tu perfil.</p></div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setConnectOpen(true)} className="w-full sm:w-auto sm:ml-auto">Conectar música</Button>
        </div>
        <form onSubmit={searchMusic} className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <SearchIcon size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Canción o artista" className="w-full bg-bg-elevated border border-border-subtle rounded-button pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted min-h-[48px]" />
          </div>
          <Button type="submit" loading={loading}>Buscar</Button>
        </form>
        {message && <p className="text-sm text-text-secondary mb-4">{message}</p>}
        {results.length === 0 && !loading ? <EmptyState icon={<SearchIcon size={40} />} title="Busca una canción" description="Podrás escuchar una muestra y agregarla a tu perfil." /> : (
          <div className="flex flex-col gap-2">
            {results.map((track) => (
              <div key={`${track.source}-${track.external_id}`} className="flex items-center gap-3 p-3 bg-bg-surface border border-border-subtle rounded-card">
                {track.cover_url ? <img src={track.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-bg-elevated flex items-center justify-center"><Music size={18} className="text-text-muted" /></div>}
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{track.title}</p><p className="text-xs text-text-secondary truncate">{track.artist_name} · {track.album_title}</p></div>
                {track.preview_url && (() => {
                  const isCurrentTrackPlaying = playingTrackId === track.external_id && isPlaying;
                  return <button onClick={() => play(track.external_id, track.title, track.artist_name, track.cover_url, track.preview_url)} className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center pressable transition-transform duration-150 ease-out" aria-label={isCurrentTrackPlaying ? 'Pausar' : 'Reproducir'}>
                    {isCurrentTrackPlaying ? <Pause key="pause" size={15} className="animate-scale-in" /> : <Play key="play" size={15} className="animate-scale-in" />}
                  </button>;
                })()}
                <button onClick={() => void addToProfile(track)} className="w-9 h-9 rounded-full bg-bg-elevated text-text-secondary flex items-center justify-center pressable" aria-label="Agregar a mi perfil"><Plus size={17} /></button>
              </div>
            ))}
          </div>
        )}
        <Modal open={connectOpen} onClose={() => setConnectOpen(false)} title="Conectar mi música">
          <p className="text-sm text-text-secondary mb-4">Elige cómo quieres traer tus canciones a Mi Onda.</p>
          <div className="grid gap-2">
            {[
              { icon: Link2, title: 'Pegar un enlace', text: 'Spotify, YouTube Music o SoundCloud.', mode: 'link' as const },
              { icon: Upload, title: 'Subir un archivo', text: 'Importa una lista exportada desde tu reproductor.', mode: null },
              { icon: History, title: 'Last.fm', text: 'Importa tu historial de escuchas.', mode: 'lastfm' as const },
              { icon: Radio, title: 'ListenBrainz', text: 'Trae tus reproducciones recientes.', mode: null },
              { icon: ListMusic, title: 'Pegar una playlist', text: 'Añade una playlist completa como referencia.', mode: 'link' as const },
            ].map(({ icon: Icon, title, text, mode }) => (
              <button key={title} onClick={() => mode ? setConnectMode(mode) : setMessage(`${title}: próximamente`)} className="flex items-center gap-3 p-3 rounded-button bg-bg-elevated border border-border-subtle text-left hover:border-border-strong pressable">
                <Icon size={19} className="text-accent flex-shrink-0" />
                <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-text-muted">{text}</span></span>
              </button>
            ))}
          </div>
          {connectMode === 'link' && (
            <form onSubmit={resolveLink} className="mt-4 flex gap-2">
              <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="Pega aquí el enlace" className="flex-1 bg-bg-elevated border border-border-subtle rounded-button px-3 py-2 text-sm" autoFocus />
              <Button type="submit" loading={connectLoading}>Agregar</Button>
            </form>
          )}
          {connectMode === 'lastfm' && (
            <form onSubmit={importLastfm} className="mt-4 flex gap-2">
              <input value={lastfmUsername} onChange={(event) => setLastfmUsername(event.target.value)} placeholder="Tu usuario de Last.fm" className="flex-1 bg-bg-elevated border border-border-subtle rounded-button px-3 py-2 text-sm" autoFocus />
              <Button type="submit" loading={connectLoading}>Importar</Button>
            </form>
          )}
        </Modal>
      </div>
    </div>
  );
}
