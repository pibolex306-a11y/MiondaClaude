import { useCallback, useEffect, useState } from 'react';
import { Trophy, Search as SearchIcon, Play, Pause, Heart, Music, Plus, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

type Challenge = {
  id: string;
  week_key: string;
  theme: string;
  starts_at: string;
  ends_at: string;
};

type Entry = {
  id: string;
  challenge_id: string;
  user_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  preview_url: string | null;
  source_url: string | null;
  note: string | null;
  created_at: string;
  profile?: { display_name: string; emoji: string | null } | null;
  liked_by_me?: boolean;
  like_count?: number;
};

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

function currentWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const DEMO_CHALLENGE: Challenge = {
  id: 'demo-challenge',
  week_key: currentWeekKey(),
  theme: 'Canción que te hace llorar',
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const DEMO_ENTRIES: Entry[] = [
  {
    id: 'demo-1', challenge_id: 'demo-challenge', user_id: 'demo-1',
    title: 'Fix You', artist: 'Coldplay', cover_url: null, preview_url: null,
    source_url: null, note: 'No puedo evitarlo', created_at: new Date().toISOString(),
    profile: { display_name: 'Valen', emoji: '🌀' }, liked_by_me: false, like_count: 2,
  },
  {
    id: 'demo-2', challenge_id: 'demo-challenge', user_id: 'demo-2',
    title: 'Equipaje', artist: 'Bad Bunny', cover_url: null, preview_url: null,
    source_url: null, note: 'Sabe a despedida', created_at: new Date().toISOString(),
    profile: { display_name: 'Cris', emoji: '🔥' }, liked_by_me: true, like_count: 1,
  },
];

export function WeeklyChallenge() {
  const { user, profile, demoMode } = useAuth();
  const { play, togglePlay, trackId: playingId, isPlaying } = usePlayer();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [myEntry, setMyEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTheme, setNewTheme] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [entryNote, setEntryNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const weekKey = currentWeekKey();
  const isAdmin = profile?.is_admin === true;

  const loadData = useCallback(async () => {
    if (demoMode) {
      setChallenge(DEMO_CHALLENGE);
      setEntries(DEMO_ENTRIES);
      setMyEntry(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Buscar reto de la semana actual
    const { data: ch } = await supabase
      .from('challenges')
      .select('*')
      .eq('week_key', weekKey)
      .maybeSingle();

    setChallenge(ch as Challenge | null);

    if (ch) {
      // Cargar entries con perfil
      const { data: rawEntries } = await supabase
        .from('challenge_entries')
        .select(`
          id, challenge_id, user_id, title, artist, cover_url, preview_url, source_url, note, created_at,
          profile:profiles(display_name, emoji)
        `)
        .eq('challenge_id', ch.id)
        .order('created_at', { ascending: false });

      const allEntries = (rawEntries as unknown as Entry[]) || [];

      // Cargar mis likes
      let entriesWithLikes: Entry[] = allEntries;
      if (user) {
        const entryIds = allEntries.map((e) => e.id);
        if (entryIds.length > 0) {
          const { data: myLikes } = await supabase
            .from('challenge_likes')
            .select('entry_id')
            .eq('user_id', user.id)
            .in('entry_id', entryIds);
          const likedSet = new Set((myLikes || []).map((l: { entry_id: string }) => l.entry_id));

          // Contar likes por entry
          const { data: likeCounts } = await supabase
            .from('challenge_likes')
            .select('entry_id')
            .in('entry_id', entryIds);
          const countMap = new Map<string, number>();
          (likeCounts || []).forEach((l: { entry_id: string }) => {
            countMap.set(l.entry_id, (countMap.get(l.entry_id) || 0) + 1);
          });

          entriesWithLikes = allEntries.map((e) => ({
            ...e,
            liked_by_me: likedSet.has(e.id),
            like_count: countMap.get(e.id) || 0,
          }));
        }
      }

      setEntries(entriesWithLikes);
      setMyEntry(user ? entriesWithLikes.find((e) => e.user_id === user.id) || null : null);
    } else {
      setEntries([]);
      setMyEntry(null);
    }
    setLoading(false);
  }, [demoMode, weekKey, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function searchMusic(event: React.FormEvent) {
    event.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearchLoading(true);
    const { data, error } = await supabase.functions.invoke('catalog-search', { body: { query: searchQuery } });
    setSearchLoading(false);
    if (error || !data?.results) return;
    setSearchResults(data.results as SearchResult[]);
  }

  async function submitEntry(track: SearchResult) {
    if (!user || !challenge) return;
    setSubmitting(true);
    const payload = {
      challenge_id: challenge.id,
      user_id: user.id,
      title: track.title,
      artist: track.artist_name,
      cover_url: track.cover_url,
      preview_url: track.preview_url,
      source_url: track.links?.itunes || track.links?.lastfm || null,
      note: entryNote.slice(0, 140) || null,
    };

    if (myEntry) {
      await supabase.from('challenge_entries').update(payload).eq('id', myEntry.id);
    } else {
      await supabase.from('challenge_entries').upsert(payload, { onConflict: 'challenge_id,user_id' });
    }

    setSubmitting(false);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setEntryNote('');
    void loadData();
  }

  async function toggleLike(entryId: string, liked: boolean) {
    if (!user) return;
    if (liked) {
      await supabase.from('challenge_likes').delete().eq('entry_id', entryId).eq('user_id', user.id);
    } else {
      await supabase.from('challenge_likes').upsert({ entry_id: entryId, user_id: user.id });
    }
    void loadData();
  }

  async function createChallenge() {
    if (!user || !newTheme.trim()) return;
    const now = new Date();
    const wk = currentWeekKey();
    // Calcular inicio (lunes) y fin (domingo) de la semana
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    await supabase.from('challenges').insert({
      week_key: wk,
      theme: newTheme.trim(),
      starts_at: monday.toISOString(),
      ends_at: sunday.toISOString(),
      created_by: user.id,
    });
    setNewTheme('');
    setCreateOpen(false);
    void loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-32">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
            <Trophy size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Reto semanal</h1>
            <p className="text-sm text-text-secondary">Responde con una canción.</p>
          </div>
        </div>

        {/* Sin reto activo */}
        {!challenge && (
          <div className="mt-4">
            {isAdmin ? (
              <div className="bg-bg-surface border border-border-subtle rounded-card p-4">
                <p className="text-sm text-text-secondary mb-3">No hay reto activo esta semana. Crea uno para el grupo.</p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Sparkles size={16} /> Crear reto
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={<Trophy size={40} />}
                title="No hay reto esta semana"
                description="Vuelve pronto para un nuevo desafío musical."
              />
            )}
          </div>
        )}

        {/* Reto activo */}
        {challenge && (
          <>
            {/* Tarjeta del tema */}
            <div className="bg-gradient-to-br from-accent/20 via-bg-surface to-bg-elevated border border-border-subtle rounded-card p-5 mb-4">
              <p className="text-xs text-text-muted mb-1 uppercase tracking-wide">Tema de la semana</p>
              <h2 className="text-xl font-bold font-heading text-text-primary mb-2">{challenge.theme}</h2>
              <p className="text-xs text-text-secondary">
                {new Date(challenge.starts_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(challenge.ends_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </p>
            </div>

            {/* Mi respuesta */}
            <div className="bg-bg-surface border border-border-subtle rounded-card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-text-primary">Mi respuesta</p>
                {!demoMode && (
                  <Button size="sm" variant={myEntry ? 'secondary' : 'primary'} onClick={() => setSearchOpen(true)}>
                    {myEntry ? <>Cambiar</> : <><Plus size={14} /> Elegir canción</>}
                  </Button>
                )}
              </div>
              {myEntry ? (
                <div className="flex items-center gap-3 bg-bg-elevated rounded-lg p-2.5 border border-border-subtle">
                  {myEntry.cover_url ? (
                    <img src={myEntry.cover_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-bg-hover flex items-center justify-center flex-shrink-0">
                      <Music size={16} className="text-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{myEntry.title}</p>
                    <p className="text-xs text-text-muted truncate">{myEntry.artist}</p>
                  </div>
                  {myEntry.preview_url && (
                    <button
                      onClick={() => play(myEntry!.id, myEntry!.title, myEntry!.artist, myEntry!.cover_url, myEntry!.preview_url)}
                      className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white pressable flex-shrink-0"
                      aria-label="Reproducir"
                    >
                      {playingId === myEntry.id && isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  {demoMode ? 'Inicia sesión para participar.' : 'Aún no has respondido.'}
                </p>
              )}
              {myEntry?.note && (
                <p className="text-xs text-text-secondary italic mt-2">"{myEntry.note}"</p>
              )}
            </div>

            {/* Respuestas del grupo */}
            <div>
              <p className="text-sm font-bold font-heading mb-3 text-text-primary">Respuestas del grupo ({entries.length})</p>
              {entries.length === 0 ? (
                <p className="text-sm text-text-muted">Nadie ha respondido todavía. ¡Sé el primero!</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {entries.map((entry) => {
                    const isPlayingThis = playingId === entry.id && isPlaying;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 bg-bg-surface border border-border-subtle rounded-card p-3">
                        {entry.cover_url ? (
                          <img src={entry.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
                            <Music size={18} className="text-text-muted" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.title}</p>
                          <p className="text-xs text-text-muted truncate">{entry.artist}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {entry.profile?.emoji && <span className="text-xs">{entry.profile.emoji}</span>}
                            <span className="text-xs text-text-secondary truncate">{entry.profile?.display_name || 'Alguien'}</span>
                          </div>
                        </div>
                        {entry.preview_url && (
                          <button
                            onClick={() => {
                              if (playingId === entry.id) togglePlay();
                              else play(entry.id, entry.title, entry.artist, entry.cover_url, entry.preview_url);
                            }}
                            className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center pressable flex-shrink-0"
                            aria-label={isPlayingThis ? 'Pausar' : 'Reproducir'}
                          >
                            {isPlayingThis ? <Pause size={15} /> : <Play size={15} />}
                          </button>
                        )}
                        {!demoMode && (
                          <button
                            onClick={() => void toggleLike(entry.id, !!entry.liked_by_me)}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1.5 rounded-full pressable flex-shrink-0 transition-colors',
                              entry.liked_by_me ? 'bg-accent/15 text-accent' : 'bg-bg-elevated text-text-muted hover:text-text-primary',
                            )}
                            aria-label="Me gusta"
                          >
                            <Heart size={14} className={entry.liked_by_me ? 'fill-accent' : ''} />
                            {entry.like_count != null && entry.like_count > 0 && (
                              <span className="text-xs font-medium">{entry.like_count}</span>
                            )}
                          </button>
                        )}
                        {demoMode && entry.like_count != null && (
                          <div className="flex items-center gap-1 text-text-muted flex-shrink-0">
                            <Heart size={14} className={entry.liked_by_me ? 'fill-accent text-accent' : ''} />
                            <span className="text-xs">{entry.like_count}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal: buscar canción */}
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Elige una canción">
        <form onSubmit={searchMusic} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Canción o artista"
              className="w-full bg-bg-elevated border border-border-subtle rounded-button pl-9 pr-3 py-2.5 text-sm"
              autoFocus
            />
          </div>
          <Button type="submit" size="sm" loading={searchLoading}>Buscar</Button>
        </form>

        {searchResults.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
            {searchResults.map((track) => (
              <button
                key={`${track.source}-${track.external_id}`}
                onClick={() => void submitEntry(track)}
                disabled={submitting}
                className="flex items-center gap-3 p-2 rounded-lg bg-bg-elevated border border-border-subtle text-left hover:border-accent pressable disabled:opacity-50"
              >
                {track.cover_url ? (
                  <img src={track.cover_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-bg-hover flex items-center justify-center flex-shrink-0">
                    <Music size={16} className="text-text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.title}</p>
                  <p className="text-xs text-text-muted truncate">{track.artist_name}</p>
                </div>
                <Plus size={16} className="text-accent flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {(searchResults.length > 0 || searchQuery) && (
          <div className="mt-4 border-t border-border-subtle pt-3">
            <p className="text-xs text-text-muted mb-2">Nota (opcional, máx. 140)</p>
            <input
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value.slice(0, 140))}
              placeholder="¿Por qué elegiste esta canción?"
              className="w-full bg-bg-elevated border border-border-subtle rounded-button px-3 py-2 text-sm"
            />
          </div>
        )}
      </Modal>

      {/* Modal: crear reto (admin) */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Crear reto semanal">
        <p className="text-sm text-text-secondary mb-3">Define el tema para esta semana ({weekKey}).</p>
        <form
          onSubmit={(e) => { e.preventDefault(); void createChallenge(); }}
          className="flex gap-2"
        >
          <input
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
            placeholder="Ej: Canción que te da energía"
            className="flex-1 bg-bg-elevated border border-border-subtle rounded-button px-3 py-2.5 text-sm"
            autoFocus
          />
          <Button type="submit">Crear</Button>
        </form>
      </Modal>
    </div>
  );
}
