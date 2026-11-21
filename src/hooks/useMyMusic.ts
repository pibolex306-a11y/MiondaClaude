import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { trackKey, DEMO_MY_MUSIC, type AffinityInput } from '@/lib/affinity';

// Carga los datos musicales del usuario actual para cálculo de afinidad.
export function useMyMusic(): AffinityInput | null {
  const { user, demoMode } = useAuth();
  const [data, setData] = useState<AffinityInput | null>(null);

  useEffect(() => {
    if (demoMode) {
      setData(DEMO_MY_MUSIC);
      return;
    }
    if (!user) { setData(null); return; }
    let cancelled = false;

    async function load() {
      const uid = user!.id;
      const [pa, pg, pt] = await Promise.all([
        supabase.from('profile_artists').select('artist:artists(name)').eq('profile_id', uid),
        supabase.from('profile_genres').select('genre:genres(label)').eq('profile_id', uid),
        supabase.from('profile_tracks').select('track:tracks(title, artist_name)').eq('profile_id', uid).eq('kind', 'favorite'),
      ]);

      if (cancelled) return;

      const artists = ((pa.data as unknown as { artist: { name: string } | null }[]) || [])
        .map((r) => r.artist?.name)
        .filter((n): n is string => !!n);
      const genres = ((pg.data as unknown as { genre: { label: string } | null }[]) || [])
        .map((r) => r.genre?.label)
        .filter((n): n is string => !!n);
      const favTracks = ((pt.data as unknown as { track: { title: string; artist_name: string | null } | null }[]) || [])
        .map((r) => r.track ? { key: trackKey(r.track.title, r.track.artist_name), display: r.track.title } : null)
        .filter((t): t is { key: string; display: string } => !!t);

      setData({ artists, genres, favoriteTracks: favTracks, favoriteCount: favTracks.length });
    }

    void load();
    return () => { cancelled = true; };
  }, [user, demoMode]);

  return data;
}
