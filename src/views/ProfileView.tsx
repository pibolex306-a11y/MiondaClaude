import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Music, Heart, Mic, Disc3, Sparkles, Plus, ExternalLink, Share2, Flag, Play, Pause, Lock, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useMyMusic } from '@/hooks/useMyMusic';
import { usePlayer } from '@/hooks/usePlayer';
import { useCurrentSnapshot, updateProfileField } from '@/hooks/useSnapshot';
import { useNowPlaying, type NowPlayingInfo } from '@/hooks/useNowPlaying';
import { computeAffinity, trackKey, type AffinityResult } from '@/lib/affinity';
import { currentMonthKey } from '@/lib/wrapped';
import type { Profile, Track, ProfileTrack, ProfileEmbed } from '@/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NowPlayingBadge } from '@/components/NowPlayingBadge';
import { getInitials, truncate, timeAgo, cn } from '@/lib/utils';
import { APP_CONFIG } from '@/config/app';
import { SimilarMusic } from '@/components/SimilarMusic';

type FullProfile = Profile & {
  artists: { artist_id: string; is_main: boolean; artist: { name: string } }[];
  genres: { genre_id: string; genre: { label: string } }[];
  tracks: { id: string; kind: string; position: number; track: Track }[];
  embeds: ProfileEmbed[];
  ai_analysis: { id: string; content: string } | null;
};

type Props = {
  profileId: string;
  onBack: () => void;
  preview?: boolean;
  onNavigate?: (tab: 'buscar') => void;
};

export function ProfileView({ profileId, onBack, preview = false, onNavigate }: Props) {
  const { profile: myProfile, user, refreshProfile } = useAuth();
  const myMusic = useMyMusic();
  const { play, togglePlay, trackId: playingId, isPlaying } = usePlayer();
  const { snapshot } = useCurrentSnapshot();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingField, setTogglingField] = useState<string | null>(null);
  const [nowPlayingInfo, setNowPlayingInfo] = useState<NowPlayingInfo | null>(null);

  const isOwn = preview || profileId === user?.id;

  const affinity: AffinityResult | null = useMemo(() => {
    if (!myMusic || !profile || isOwn) return null;
    const theirArtists = profile.artists.map((a) => a.artist.name);
    const theirGenres = profile.genres.map((g) => g.genre.label);
    const theirFavTracks = profile.tracks
      .filter((t) => t.kind === 'favorite')
      .map((t) => ({ key: trackKey(t.track.title, t.track.artist_name), display: t.track.title }));
    return computeAffinity(myMusic, {
      artists: theirArtists,
      genres: theirGenres,
      favoriteTracks: theirFavTracks,
      favoriteCount: theirFavTracks.length,
    });
  }, [myMusic, profile, isOwn]);

  useEffect(() => {
    if (preview) {
      const track: Track = {
        id: 'preview-track-1', source: 'manual', external_id: null, title: 'Goteo', artist_name: 'Duki', artist_id: null, album_title: null, cover_url: null, preview_url: null, duration_s: null, isrc: null, links: {}, tags: [], is_manual: true, created_at: new Date().toISOString(),
      };
      setProfile({
        id: 'preview-cris', role: 'admin', display_name: 'Cris', emoji: '🔥', cover_url: null, bio: 'Tengo gustos exóticos jaja. Vivo el trap argentino 24/7.', why_main_artist: 'Me acompaña cuando necesito energía y también cuando quiero desconectarme.', theme: 'oscuro', accent: null, lastfm_username: 'demo_cris', listenbrainz_username: null, show_ai_public: false, is_admin: true, is_hidden: false, claimed: true, suspended: false, wrapped_opt_in: true, show_now_playing: true, notion_origin: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        artists: [{ artist_id: 'preview-artist', is_main: true, artist: { name: 'Duki' } }], genres: [{ genre_id: 'preview-genre', genre: { label: 'Trap' } }, { genre_id: 'preview-genre-2', genre: { label: 'Rap/Hip-Hop' } }], tracks: [{ id: 'preview-profile-track', kind: 'favorite', position: 0, track }], embeds: [], ai_analysis: null,
      });
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);

      const { data: p, error: e1 } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();
      if (e1 || !p) { setError('No se pudo cargar este perfil.'); setLoading(false); return; }

      const [pa, pg, pt, pe, ai] = await Promise.all([
        supabase.from('profile_artists').select('artist_id, is_main, artist:artists(name)').eq('profile_id', profileId),
        supabase.from('profile_genres').select('genre_id, genre:genres(label)').eq('profile_id', profileId),
        supabase.from('profile_tracks').select('id, kind, position, track:tracks(*)').eq('profile_id', profileId).order('position'),
        supabase.from('profile_embeds').select('*').eq('profile_id', profileId).order('position'),
        supabase.from('ai_analyses').select('id, content').eq('profile_id', profileId).eq('is_public', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const full: FullProfile = {
        ...(p as Profile),
        artists: (pa.data as unknown as FullProfile['artists']) || [],
        genres: (pg.data as unknown as FullProfile['genres']) || [],
        tracks: (pt.data as unknown as FullProfile['tracks']) || [],
        embeds: (pe.data as ProfileEmbed[]) || [],
        ai_analysis: (ai.data as { id: string; content: string } | null) || null,
      };
      setProfile(full);
      setLoading(false);
    }
    void load();
  }, [profileId, preview]);

  // Ahora suena: consultar Last.fm si el perfil tiene show_now_playing y lastfm_username
  const nowPlayingUsernames = useMemo(() => {
    const map = new Map<string, string>();
    if (preview || !profile) return map;
    if (profile.show_now_playing && profile.lastfm_username) {
      map.set(profile.id, profile.lastfm_username);
    }
    return map;
  }, [preview, profile]);

  const liveNowPlaying = useNowPlaying({ usernames: nowPlayingUsernames, enabled: !preview && !!profile?.show_now_playing && !!profile?.lastfm_username });

  useEffect(() => {
    if (preview) {
      // En demo, mostrar "Ahora suena" falso si el perfil lo tiene activado
      if (profile?.show_now_playing && profile?.id === 'preview-cris') {
        setNowPlayingInfo({ now_playing: true, title: 'Goteo', artist: 'Duki', cover_url: null });
      } else {
        setNowPlayingInfo(null);
      }
      return;
    }
    setNowPlayingInfo(liveNowPlaying.get(profileId) ?? null);
  }, [preview, profile, profileId, liveNowPlaying]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <EmptyState
          icon={<Music size={40} />}
          title="No se pudo cargar este perfil"
          description={error || 'El perfil no existe o está oculto.'}
          action={<Button onClick={onBack}>Volver al muro</Button>}
        />
      </div>
    );
  }

  const mainArtist = profile.artists.find((a) => a.is_main);
  const top3 = profile.tracks.filter((t) => t.kind === 'top3').sort((a, b) => a.position - b.position);
  const favorites = profile.tracks.filter((t) => t.kind === 'favorite');
  const allTracks = profile.tracks;
  const trackCount = allTracks.length;

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch { /* ignore */ }
  }

  async function handleReport() {
    if (!myProfile || !user) return;
    const reason = prompt('¿Qué quieres reportar?');
    if (!reason) return;
    await supabase.from('reports').insert({
      reporter_id: user.id,
      target_profile_id: profileId,
      reason,
    });
  }

  async function handleToggle(field: 'wrapped_opt_in' | 'show_now_playing', value: boolean) {
    if (!user) return;
    setTogglingField(field);
    await updateProfileField(user.id, field, value);
    await refreshProfile();
    setTogglingField(null);
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Portada */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/40 via-bg-elevated to-secondary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-bg-base" />

        {/* Botón volver */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white pressable safe-top"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Acciones */}
        {!isOwn && (
          <div className="absolute top-4 right-4 flex gap-2 safe-top">
            <button onClick={handleShare} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white pressable" aria-label="Compartir">
              <Share2 size={18} />
            </button>
            <button onClick={handleReport} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white pressable" aria-label="Reportar">
              <Flag size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Cabecera */}
      <div className="px-4 -mt-12 relative">
        <div className="flex items-end gap-3 mb-4">
          {profile.emoji ? (
            <div className="w-20 h-20 rounded-full bg-bg-elevated border-4 border-bg-base flex items-center justify-center text-4xl">
              {profile.emoji}
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-bg-elevated border-4 border-bg-base flex items-center justify-center text-xl font-bold">
              {getInitials(profile.display_name)}
            </div>
          )}
          <div className="flex-1 min-w-0 pb-2">
            <h1 className="text-2xl font-bold font-heading truncate">{profile.display_name}</h1>
            {mainArtist && (
              <p className="text-sm text-accent font-medium truncate">{mainArtist.artist.name}</p>
            )}
            <p className="text-xs text-text-muted mt-0.5">Actualizado {timeAgo(profile.updated_at)}</p>
          </div>
        </div>

        {/* Géneros */}
        {profile.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.genres.map((g) => (
              <span key={g.genre_id} className="text-xs px-2.5 py-1 rounded-chip bg-bg-elevated text-text-secondary border border-border-subtle">
                {g.genre.label}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">{profile.bio}</p>
        )}

        {/* Ahora suena */}
        {nowPlayingInfo && (
          <div className="mb-6">
            <NowPlayingBadge info={nowPlayingInfo} />
          </div>
        )}

        {/* Afinidad con el usuario actual */}
        {!isOwn && affinity && affinity.reason === 'ok' && (
          <div className="mb-6 bg-bg-surface border border-border-subtle rounded-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-accent/15 flex-shrink-0">
                <span className="text-xl font-bold text-accent leading-none">{affinity.score}%</span>
                <span className="text-[10px] text-text-muted mt-0.5">de onda</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Compatibilidad musical</p>
                {affinity.coincidences.length > 0 ? (
                  <div className="flex flex-col gap-0.5 mt-1">
                    {affinity.coincidences.map((c, i) => (
                      <p key={i} className="text-xs text-text-secondary flex items-center gap-1">
                        <Music size={11} className="text-accent flex-shrink-0" />
                        <span className="truncate">{c}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted mt-1">Sin coincidencias destacadas.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!isOwn && affinity && affinity.reason === 'me_needs_favorites' && (
          <div className="mb-6 bg-bg-surface border border-border-subtle rounded-card p-4">
            <p className="text-sm text-text-secondary mb-3">Agrega 2 favoritas para ver tu onda con {profile.display_name}.</p>
            <Button size="sm" variant="secondary" onClick={() => onNavigate?.('buscar')}>Ir a Buscar</Button>
          </div>
        )}

        {!isOwn && affinity && affinity.reason === 'them_needs_favorites' && (
          <div className="mb-6 bg-bg-surface border border-border-subtle rounded-card p-4">
            <p className="text-sm text-text-muted">{profile.display_name} aún no tiene suficientes favoritas para comparar.</p>
          </div>
        )}

        {/* Botón editar (perfil propio) */}
        {isOwn && (
          <div className="mb-6">
            <Button variant="secondary" size="sm">
              <Plus size={16} /> Agregar música
            </Button>
          </div>
        )}

        {/* Mi onda en cifras + interruptores (perfil propio) */}
        {isOwn && (
          <div className="mb-6 flex flex-col gap-4">
            {/* Tarjeta Mi onda en cifras */}
            <div className="bg-bg-surface border border-border-subtle rounded-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={18} className="text-accent" />
                <h2 className="text-base font-bold font-heading">Mi onda en cifras</h2>
                <span className="text-xs text-text-muted ml-auto">{currentMonthKey()}</span>
              </div>
              {snapshot && (snapshot.top_artists.length > 0 || snapshot.top_tracks.length > 0 || snapshot.top_genres.length > 0) ? (
                <div className="flex flex-col gap-3">
                  {snapshot.top_artists.length > 0 && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Top artistas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {snapshot.top_artists.slice(0, 5).map((a, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-chip bg-accent/15 text-accent font-medium">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {snapshot.top_tracks.length > 0 && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Top canciones</p>
                      <div className="flex flex-col gap-0.5">
                        {snapshot.top_tracks.slice(0, 5).map((t, i) => (
                          <p key={i} className="text-xs text-text-secondary truncate">
                            <span className="text-text-muted mr-1">{i + 1}.</span>{t.title} — {t.artist || 'Desconocido'}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {snapshot.top_genres.length > 0 && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Género dominante</p>
                      <p className="text-sm font-medium text-text-primary">{snapshot.top_genres[0]}</p>
                    </div>
                  )}
                  <p className="text-xs text-text-muted mt-1">Fuente: {snapshot.source === 'lastfm' ? 'Last.fm' : 'Tus favoritas'}</p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">Agrega favoritas para ver tu onda del mes.</p>
              )}
            </div>

            {/* Interruptores */}
            <div className="bg-bg-surface border border-border-subtle rounded-card p-4 flex flex-col gap-3">
              <ToggleRow
                label="Incluirme en el Resumen del grupo"
                description="Tu datos agregados aparecen en el resumen colectivo."
                value={profile.wrapped_opt_in}
                disabled={togglingField === 'wrapped_opt_in'}
                onChange={(v) => void handleToggle('wrapped_opt_in', v)}
              />
              <div className="border-t border-border-subtle" />
              <ToggleRow
                label="Mostrar lo que estoy escuchando"
                description="Otros pueden ver qué estás escuchando ahora."
                value={profile.show_now_playing}
                disabled={togglingField === 'show_now_playing'}
                onChange={(v) => void handleToggle('show_now_playing', v)}
              />
            </div>
          </div>
        )}
      </div>

      {!isOwn && (
        <div className="px-4 mb-6">
          <SimilarMusic profileId={profileId} profileName={profile.display_name} />
        </div>
      )}

      {/* Secciones */}
      <div className="px-4 flex flex-col gap-6">
        {/* Top 3 */}
        {top3.length > 0 && (
          <Section icon={<Music size={18} />} title="Mis 3 canciones que no paro de escuchar">
            <div className="flex flex-col gap-2">
              {top3.map((pt, i) => (
                <TrackRow key={pt.id} track={pt.track} index={i + 1} onPlay={play} onToggle={togglePlay} playingId={playingId} isPlaying={isPlaying} />
              ))}
            </div>
          </Section>
        )}

        {/* Artista favorito y por qué */}
        {mainArtist && (
          <Section icon={<Mic size={18} />} title="Mi artista favorito y por qué">
            <div className="bg-bg-elevated rounded-card p-4 border border-border-subtle">
              <p className="text-accent font-semibold text-lg mb-2">{mainArtist.artist.name}</p>
              {profile.why_main_artist ? (
                <p className="text-sm text-text-secondary leading-relaxed">{profile.why_main_artist}</p>
              ) : (
                <p className="text-sm text-text-muted">Aún no escribió por qué.</p>
              )}
            </div>
          </Section>
        )}

        {/* Álbumes y playlists */}
        {profile.embeds.length > 0 && (
          <Section icon={<Disc3 size={18} />} title="Álbumes y playlists destacados">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {profile.embeds.map((e) => (
                <a
                  key={e.id}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-bg-elevated rounded-card overflow-hidden border border-border-subtle pressable hover:border-border-strong transition-colors"
                >
                  {e.cover_url ? (
                    <img src={e.cover_url} alt="" className="w-full aspect-square object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-square bg-bg-hover flex items-center justify-center">
                      <Disc3 size={32} className="text-text-muted" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{e.title || e.kind}</p>
                    <p className="text-xs text-text-muted capitalize">{e.provider}</p>
                  </div>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Canción favorita */}
        {favorites.length > 0 && (
          <Section icon={<Heart size={18} />} title="Mi canción favorita">
            <TrackRow track={favorites[0].track} onPlay={play} onToggle={togglePlay} playingId={playingId} isPlaying={isPlaying} />
          </Section>
        )}

        {/* Análisis IA */}
        <Section icon={<Sparkles size={18} />} title="Análisis de IA">
          {trackCount < APP_CONFIG.minTracksForAI ? (
            <div className="bg-bg-elevated rounded-card p-4 border border-border-subtle">
              <div className="flex items-center gap-2 text-text-muted mb-2">
                <Lock size={16} />
                <span className="text-sm">Bloqueado</span>
              </div>
              <p className="text-sm text-text-secondary">
                Agrega {APP_CONFIG.minTracksForAI - trackCount} {APP_CONFIG.minTracksForAI - trackCount === 1 ? 'canción más' : 'canciones más'} para desbloquear tu análisis.
              </p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min(trackCount / APP_CONFIG.minTracksForAI * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-text-muted mt-1">{trackCount}/{APP_CONFIG.minTracksForAI}</p>
            </div>
          ) : profile.ai_analysis ? (
            <div className="bg-bg-elevated rounded-card p-4 border border-border-subtle">
              <p className="text-sm text-text-primary leading-relaxed">{profile.ai_analysis.content}</p>
              <p className="text-xs text-text-muted mt-3 italic">Solo por diversión 🎧</p>
            </div>
          ) : (
            <div className="bg-bg-elevated rounded-card p-4 border border-border-subtle">
              {isOwn ? (
                <>
                  <p className="text-sm text-text-secondary mb-3">Ya puedes generar tu análisis musical con IA.</p>
                  <Button size="sm">
                    <Sparkles size={16} /> Generar mi análisis
                  </Button>
                </>
              ) : (
                <p className="text-sm text-text-muted">Aún no ha generado su análisis.</p>
              )}
            </div>
          )}
        </Section>

        {/* Perfil vacío */}
        {trackCount === 0 && !profile.bio && !mainArtist && (
          <EmptyState
            icon={<Music size={40} />}
            title="Este perfil está en construcción"
            description={isOwn ? 'Agrega música y personaliza tu perfil para llenarlo.' : 'Aún no ha agregado música.'}
          />
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent">{icon}</span>
        <h2 className="text-lg font-bold font-heading">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 pressable',
          value ? 'bg-accent' : 'bg-bg-hover',
          disabled && 'opacity-50',
        )}
        aria-label={label}
        aria-pressed={value}
      >
        <span
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
            value ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function TrackRow({
  track,
  index,
  onPlay,
  onToggle,
  playingId,
  isPlaying,
}: {
  track: Track;
  index?: number;
  onPlay: (trackId: string, title: string, artist: string, coverUrl: string | null, previewUrl: string | null) => void;
  onToggle: () => void;
  playingId: string | null;
  isPlaying: boolean;
}) {
  const isThisPlaying = playingId === track.id && isPlaying;

  function handleClick() {
    if (playingId === track.id) {
      onToggle();
    } else {
      onPlay(track.id, track.title, track.artist_name || '', track.cover_url, track.preview_url);
    }
  }

  return (
    <div className="flex items-center gap-3 bg-bg-elevated rounded-lg p-2.5 border border-border-subtle">
      {index !== undefined && <span className="text-sm text-text-muted w-5 text-center">{index}</span>}
      {track.cover_url ? (
        <img src={track.cover_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" loading="lazy" />
      ) : (
        <div className="w-10 h-10 rounded bg-bg-hover flex items-center justify-center flex-shrink-0">
          <Music size={16} className="text-text-muted" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{track.title}</p>
        <p className="text-xs text-text-muted truncate">{track.artist_name}</p>
      </div>
      {track.preview_url && (
        <button
          onClick={handleClick}
          className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white pressable flex-shrink-0"
          aria-label={isThisPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isThisPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
      )}
      {Object.entries(track.links || {}).slice(0, 2).map(([provider, url]) => (
        <a
          key={provider}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary pressable flex-shrink-0"
          aria-label={`Ver en ${provider}`}
          title={`Ver en ${provider}`}
        >
          <ExternalLink size={14} />
        </a>
      ))}
    </div>
  );
}
