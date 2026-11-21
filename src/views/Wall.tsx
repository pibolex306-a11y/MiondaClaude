import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, LayoutGrid, Table as TableIcon, Users, Music, RefreshCw } from 'lucide-react';
import { useWallProfiles, type WallProfile } from '@/hooks/useWallProfiles';
import { useAuth } from '@/hooks/useAuth';
import { useMyMusic } from '@/hooks/useMyMusic';
import { usePlayer } from '@/hooks/usePlayer';
import { useNowPlaying, type NowPlayingMap, type NowPlayingInfo } from '@/hooks/useNowPlaying';
import { computeAffinity, type AffinityResult } from '@/lib/affinity';
import { ProfileCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { NowPlayingBadge } from '@/components/NowPlayingBadge';
import { cn, getInitials, truncate } from '@/lib/utils';
import { APP_CONFIG } from '@/config/app';

type ViewMode = 'galeria' | 'tabla' | 'artista';
type Props = { onOpenProfile: (id: string) => void; preview?: boolean };

const DEMO_NOW_PLAYING: Record<string, NowPlayingInfo> = {
  'preview-cris': { now_playing: true, title: 'Goteo', artist: 'Duki', cover_url: null },
  'preview-valen': { now_playing: true, title: 'Tití Me Preguntó', artist: 'Bad Bunny', cover_url: null },
};

export function Wall({ onOpenProfile, preview = false }: Props) {
  const { profiles, loading, error, refetch } = useWallProfiles(preview);
  const { profile: myProfile } = useAuth();
  const myMusic = useMyMusic();
  const { play } = usePlayer();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem('mi_onda_view') as ViewMode) || 'galeria');
  const [showFilters, setShowFilters] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recientes' | 'az' | 'afines'>('recientes');

  // Ahora suena: construir mapa de profileId -> lastfm_username para perfiles con show_now_playing
  const nowPlayingUsernames = useMemo(() => {
    const map = new Map<string, string>();
    if (preview) return map;
    for (const p of profiles) {
      if (p.show_now_playing && p.lastfm_username) {
        map.set(p.id, p.lastfm_username);
      }
    }
    return map;
  }, [profiles, preview]);

  const liveNowPlaying = useNowPlaying({ usernames: nowPlayingUsernames, enabled: !preview });

  // En modo demo, usar datos falsos
  const nowPlayingMap: NowPlayingMap = useMemo(() => {
    if (preview) {
      const map = new Map<string, NowPlayingInfo>();
      for (const [id, info] of Object.entries(DEMO_NOW_PLAYING)) {
        map.set(id, info);
      }
      return map;
    }
    return liveNowPlaying;
  }, [preview, liveNowPlaying]);

  function setViewMode(v: ViewMode) {
    setView(v);
    localStorage.setItem('mi_onda_view', v);
  }

  // Afinidad de cada perfil conmigo
  const affinityMap = useMemo(() => {
    const map = new Map<string, AffinityResult>();
    if (!myMusic) return map;
    for (const p of profiles) {
      if (p.id === myProfile?.id) continue;
      map.set(p.id, computeAffinity(myMusic, {
        artists: p.all_artist_names,
        genres: p.genre_labels,
        favoriteTracks: p.favorite_track_keys,
        favoriteCount: p.favorite_count,
      }));
    }
    return map;
  }, [profiles, myMusic, myProfile?.id]);

  // Todos los géneros disponibles para filtros
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => p.genre_labels.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [profiles]);

  // Todos los artistas para filtros
  const allArtists = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => p.all_artist_names.forEach((a) => set.add(a)));
    return Array.from(set).sort();
  }, [profiles]);

  // Filtrado
  const filtered = useMemo(() => {
    let result = [...profiles];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.display_name.toLowerCase().includes(q) ||
        p.all_artist_names.some((a) => a.toLowerCase().includes(q)) ||
        p.genre_labels.some((g) => g.toLowerCase().includes(q)) ||
        (p.favorite_track?.title?.toLowerCase().includes(q) ?? false),
      );
    }

    if (genreFilter.length > 0) {
      result = result.filter((p) => genreFilter.some((g) => p.genre_labels.includes(g)));
    }

    if (artistFilter) {
      result = result.filter((p) => p.all_artist_names.includes(artistFilter));
    }

    if (sortBy === 'az') {
      result.sort((a, b) => a.display_name.localeCompare(b.display_name));
    } else if (sortBy === 'afines') {
      result.sort((a, b) => {
        const aScore = affinityMap.get(a.id)?.score ?? -1;
        const bScore = affinityMap.get(b.id)?.score ?? -1;
        return bScore - aScore;
      });
    }
    // 'recientes' ya viene ordenado por updated_at

    return result;
  }, [profiles, search, genreFilter, artistFilter, sortBy, affinityMap]);

  // Agrupar por artista para vista "Por artista"
  const byArtist = useMemo(() => {
    const map = new Map<string, WallProfile[]>();
    filtered.forEach((p) => {
      const main = p.main_artist_name || 'Sin artista';
      const arr = map.get(main) || [];
      arr.push(p);
      map.set(main, arr);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  function clearFilters() {
    setGenreFilter([]);
    setArtistFilter(null);
    setSortBy('recientes');
  }

  const activeFilters = genreFilter.length + (artistFilter ? 1 : 0) + (sortBy !== 'recientes' ? 1 : 0);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-20 glass safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                <Music size={18} className="text-accent" />
              </div>
              <h1 className="text-xl font-bold font-heading">{APP_CONFIG.name}</h1>
            </div>
            <button
              onClick={() => void refetch()}
              className="p-2 text-text-muted hover:text-text-primary pressable rounded-lg"
              aria-label="Actualizar"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Buscador */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por nombre, artista, canción o género..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-elevated border border-border-subtle rounded-button pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent transition-colors min-h-[44px]"
            />
          </div>

          {/* Controles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-button text-sm font-medium pressable transition-colors min-h-[40px]',
                activeFilters > 0
                  ? 'bg-accent text-white'
                  : 'bg-bg-elevated text-text-secondary border border-border-subtle hover:bg-bg-hover',
              )}
            >
              <SlidersHorizontal size={14} />
              Filtros
              {activeFilters > 0 && <span className="ml-0.5 text-xs">{activeFilters}</span>}
            </button>

            <div className="flex-1" />

            {/* Selector de vista */}
            <div className="ml-auto flex items-center gap-1 bg-bg-elevated rounded-button p-1 border border-border-subtle">
              {([
                { mode: 'galeria', icon: LayoutGrid, label: 'Galería' },
                { mode: 'tabla', icon: TableIcon, label: 'Tabla' },
                { mode: 'artista', icon: Users, label: 'Por artista' },
              ] as const).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'p-1.5 rounded-lg pressable transition-colors',
                    view === mode
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                  aria-label={label}
                  title={label}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de filtros */}
        {showFilters && (
          <div className="px-4 pb-4 border-t border-border-subtle animate-slide-up">
            <div className="pt-3 flex flex-col gap-4">
              {/* Géneros */}
              <div>
                <p className="text-sm font-medium text-text-secondary mb-2">Géneros</p>
                <div className="flex flex-wrap gap-2">
                  {allGenres.map((g) => (
                    <Chip
                      key={g}
                      selected={genreFilter.includes(g)}
                      onClick={() => setGenreFilter((prev) =>
                        prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
                      )}
                    >
                      {g}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Artista */}
              <div>
                <p className="text-sm font-medium text-text-secondary mb-2">Artista</p>
                <select
                  value={artistFilter || ''}
                  onChange={(e) => setArtistFilter(e.target.value || null)}
                  className="w-full bg-bg-elevated border border-border-subtle rounded-button px-4 py-2.5 text-sm text-text-primary min-h-[44px]"
                >
                  <option value="">Todos los artistas</option>
                  {allArtists.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Orden */}
              <div>
                <p className="text-sm font-medium text-text-secondary mb-2">Orden</p>
                <div className="flex gap-2">
                  {(['recientes', 'az', 'afines'] as const).map((s) => (
                    <Chip key={s} selected={sortBy === s} onClick={() => setSortBy(s)}>
                      {s === 'recientes' ? 'Recientes' : s === 'az' ? 'A-Z' : 'Más afines'}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Limpiar */}
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 px-4 py-4 pb-32">
        {/* Error */}
        {error && (
          <EmptyState
            title="No se pudo cargar el muro"
            description={error}
            action={<Button onClick={() => void refetch()}>Intentar de nuevo</Button>}
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <ProfileCardSkeleton key={i} />)}
          </div>
        )}

        {/* Vacío */}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<Search size={40} />}
            title="Nadie coincide con esos filtros"
            description="Prueba quitar uno o cambiar la búsqueda."
            action={activeFilters > 0 ? <Button variant="secondary" size="sm" onClick={clearFilters}>Limpiar</Button> : undefined}
          />
        )}

        {/* Vista Galería */}
        {!loading && !error && view === 'galeria' && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <ProfileCard key={p.id} profile={p} onOpen={onOpenProfile} onPlay={play} affinity={affinityMap.get(p.id)} nowPlaying={nowPlayingMap.get(p.id)} />
            ))}
          </div>
        )}

        {/* Vista Tabla */}
        {!loading && !error && view === 'tabla' && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted border-b border-border-subtle">
                  <th className="text-left py-2 px-3 font-medium">Alumno</th>
                  <th className="text-left py-2 px-3 font-medium">Artista fav</th>
                  <th className="text-left py-2 px-3 font-medium">Canción fav</th>
                  <th className="text-left py-2 px-3 font-medium">Géneros</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onOpenProfile(p.id)}
                    className="border-b border-border-subtle/50 cursor-pointer hover:bg-bg-hover pressable transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {p.emoji ? <span className="text-lg">{p.emoji}</span> : (
                          <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold">
                            {getInitials(p.display_name)}
                          </div>
                        )}
                        <span className="font-medium text-text-primary">{p.display_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-text-secondary">{p.main_artist_name || '—'}</td>
                    <td className="py-3 px-3 text-text-secondary">{p.favorite_track?.title ? truncate(p.favorite_track.title, 30) : '—'}</td>
                    <td className="py-3 px-3 text-text-secondary">{p.genre_labels.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Vista Por artista */}
        {!loading && !error && view === 'artista' && byArtist.length > 0 && (
          <div className="flex flex-col gap-6">
            {byArtist.map(([artist, members]) => (
              <div key={artist}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-bold font-heading">{artist}</h3>
                  <span className="text-sm text-text-muted">{members.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {members.map((p) => (
                    <ProfileCard key={p.id} profile={p} onOpen={onOpenProfile} onPlay={play} affinity={affinityMap.get(p.id)} compact nowPlaying={nowPlayingMap.get(p.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contador */}
        {!loading && !error && filtered.length > 0 && (
          <p className="text-center text-sm text-text-muted mt-6">
            {filtered.length} {filtered.length === 1 ? 'perfil' : 'perfiles'}
          </p>
        )}
      </div>
    </div>
  );
}

// Tarjeta de perfil para vista galería
function ProfileCard({
  profile,
  onOpen,
  onPlay,
  affinity,
  compact,
  nowPlaying,
}: {
  profile: WallProfile;
  onOpen: (id: string) => void;
  onPlay: (trackId: string, title: string, artist: string, coverUrl: string | null, previewUrl: string | null) => void;
  affinity?: AffinityResult;
  compact?: boolean;
  nowPlaying?: NowPlayingInfo;
}) {
  const ft = profile.favorite_track;
  return (
    <div
      onClick={() => onOpen(profile.id)}
      className="bg-bg-surface border border-border-subtle rounded-card overflow-hidden pressable cursor-pointer hover:border-border-strong transition-all duration-150 animate-scale-in"
    >
      {/* Cabecera con portada o gradiente */}
      <div className="h-20 relative overflow-hidden">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/30 to-secondary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-surface to-transparent" />
      </div>

      {/* Cuerpo */}
      <div className="p-4 -mt-8 relative">
        <div className="flex items-end gap-2 mb-3">
          {profile.emoji ? (
            <div className="w-12 h-12 rounded-full bg-bg-elevated border-2 border-bg-surface flex items-center justify-center text-2xl">
              {profile.emoji}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-bg-elevated border-2 border-bg-surface flex items-center justify-center font-bold text-sm">
              {getInitials(profile.display_name)}
            </div>
          )}
          <div className="flex-1 min-w-0 pb-1">
            <h3 className="font-semibold text-text-primary truncate">{profile.display_name}</h3>
            {profile.main_artist_name && (
              <p className="text-xs text-accent font-medium truncate">{profile.main_artist_name}</p>
            )}
          </div>
          {affinity?.reason === 'ok' && affinity.score != null && (
            <div className="flex flex-col items-end pb-1 flex-shrink-0">
              <span className="text-lg font-bold text-accent leading-none">{affinity.score}%</span>
              <span className="text-[10px] text-text-muted">de onda</span>
            </div>
          )}
        </div>

        {!compact && affinity?.reason === 'ok' && affinity.coincidences.length > 0 && (
          <div className="flex flex-col gap-1 mb-3">
            {affinity.coincidences.map((c, i) => (
              <p key={i} className="text-xs text-text-secondary flex items-center gap-1">
                <Music size={11} className="text-accent flex-shrink-0" />
                <span className="truncate">{c}</span>
              </p>
            ))}
          </div>
        )}

        {!compact && affinity?.reason === 'me_needs_favorites' && (
          <p className="text-xs text-text-muted mb-3">Agrega 2 favoritas para ver tu onda</p>
        )}

        {!compact && affinity?.reason === 'them_needs_favorites' && (
          <p className="text-xs text-text-muted mb-3">Aún sin favoritas para comparar</p>
        )}

        {!compact && (
          <>
            {/* Canción favorita */}
            {ft && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-bg-elevated rounded-lg">
                {ft.cover_url && (
                  <img src={ft.cover_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{ft.title}</p>
                  <p className="text-xs text-text-muted truncate">{ft.artist_name}</p>
                </div>
                {ft.preview_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(ft.id, ft.title, ft.artist_name || '', ft.cover_url, ft.preview_url);
                    }}
                    className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white pressable flex-shrink-0"
                    aria-label="Reproducir"
                  >
                    <span className="text-xs">▶</span>
                  </button>
                )}
              </div>
            )}

            {/* Géneros */}
            {profile.genre_labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.genre_labels.slice(0, 2).map((g) => (
                  <span key={g} className="text-xs px-2 py-1 rounded-chip bg-bg-elevated text-text-secondary">
                    {g}
                  </span>
                ))}
                {profile.genre_labels.length > 2 && (
                  <span className="text-xs px-2 py-1 text-text-muted">+{profile.genre_labels.length - 2}</span>
                )}
              </div>
            )}
          </>
        )}

        {/* Ahora suena */}
        {nowPlaying && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <NowPlayingBadge info={nowPlaying} />
          </div>
        )}
      </div>
    </div>
  );
}
