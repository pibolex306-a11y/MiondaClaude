import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { currentMonthKey } from '@/lib/wrapped';

// Sincroniza el snapshot mensual al abrir la app y registra reproducciones tras 30 s.
export function useHistorySync() {
  const { user, profile, demoMode } = useAuth();
  const { trackId, title, artist, isPlaying, progress } = usePlayer();
  const loggedRef = useRef<string | null>(null);
  const lastPlayLogRef = useRef<Map<string, number>>(new Map());

  // Snapshot mensual
  useEffect(() => {
    if (demoMode || !user || !profile) return;
    if (profile.wrapped_opt_in === false) return;

    let cancelled = false;
    async function syncSnapshot() {
      if (cancelled || !user) return;
      const monthKey = currentMonthKey();

      // Cargar favoritas, artistas y géneros del usuario
      const [pt, pa, pg] = await Promise.all([
        supabase.from('profile_tracks')
          .select('kind, track:tracks(title, artist_name)')
          .eq('profile_id', user.id)
          .in('kind', ['favorite', 'top3']),
        supabase.from('profile_artists')
          .select('is_main, artist:artists(name)')
          .eq('profile_id', user.id),
        supabase.from('profile_genres')
          .select('genre:genres(label)')
          .eq('profile_id', user.id),
      ]);

      if (cancelled) return;

      const favorites = ((pt.data as unknown as { kind: string; track: { title: string; artist_name: string | null } | null }[]) || [])
        .filter((r) => r.kind === 'favorite' && r.track)
        .map((r) => ({ title: r.track!.title, artist: r.track!.artist_name }));

      const top3Tracks = ((pt.data as unknown as { kind: string; track: { title: string; artist_name: string | null } | null }[]) || [])
        .filter((r) => r.kind === 'top3' && r.track)
        .map((r) => ({ title: r.track!.title, artist: r.track!.artist_name }));

      const artists = ((pa.data as unknown as { is_main: boolean; artist: { name: string } | null }[]) || [])
        .map((r) => ({ name: r.artist?.name ?? '', is_main: r.is_main }))
        .filter((a) => a.name)
        .sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0));

      const genres = ((pg.data as unknown as { genre: { label: string } | null }[]) || [])
        .map((r) => r.genre?.label)
        .filter((g): g is string => !!g);

      const topArtists = artists.slice(0, 5).map((a) => a.name);
      const topTracks = [...favorites, ...top3Tracks].slice(0, 5).map((t) => ({ title: t.title, artist: t.artist }));
      const topGenres = genres.slice(0, 3);

      const source = profile!.lastfm_username ? 'lastfm' : 'app';

      // Check existing snapshot
      const { data: existing } = await supabase
        .from('music_snapshots')
        .select('id, updated_at')
        .eq('user_id', user.id)
        .eq('month_key', monthKey)
        .maybeSingle();

      if (cancelled) return;

      const payload = {
        user_id: user.id,
        month_key: monthKey,
        top_artists: topArtists,
        top_tracks: topTracks,
        top_genres: topGenres,
        favorites: favorites,
        source,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const ageHours = (Date.now() - new Date(existing.updated_at).getTime()) / (1000 * 60 * 60);
        if (ageHours < 24) return; // no actualizar si tiene menos de 24 h
        await supabase.from('music_snapshots').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('music_snapshots').insert(payload);
      }
    }

    void syncSnapshot();
    return () => { cancelled = true; };
  }, [user, profile, demoMode]);

  // Registrar reproducción tras 30 s
  useEffect(() => {
    if (demoMode || !user || !profile || profile.wrapped_opt_in === false) return;
    if (!isPlaying || !trackId || progress < 30) return;

    // Evitar duplicados para la misma pista en la misma sesión de reproducción
    if (loggedRef.current === trackId) return;

    // Máximo una por canción cada 10 minutos
    const now = Date.now();
    const lastLogged = lastPlayLogRef.current.get(trackId);
    if (lastLogged && now - lastLogged < 10 * 60 * 1000) return;

    loggedRef.current = trackId;
    lastPlayLogRef.current.set(trackId, now);

    void supabase.from('song_plays').insert({
      user_id: user.id,
      track_key: trackId,
      title,
      artist,
      played_at: new Date().toISOString(),
    });
  }, [user, profile, demoMode, trackId, title, artist, isPlaying, progress]);
}
