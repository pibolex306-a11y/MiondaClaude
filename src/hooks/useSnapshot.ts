import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { currentMonthKey } from '@/lib/wrapped';

export type Snapshot = {
  id: string;
  top_artists: string[];
  top_tracks: { title: string; artist: string | null }[];
  top_genres: string[];
  favorites: { title: string; artist: string | null }[];
  source: string;
  updated_at: string;
};

// Carga el snapshot del mes actual del usuario.
export function useCurrentSnapshot() {
  const { user, demoMode } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demoMode || !user) { setSnapshot(null); setLoading(false); return; }
    let cancelled = false;

    async function load() {
      const monthKey = currentMonthKey();
      const { data } = await supabase
        .from('music_snapshots')
        .select('id, top_artists, top_tracks, top_genres, favorites, source, updated_at')
        .eq('user_id', user!.id)
        .eq('month_key', monthKey)
        .maybeSingle();

      if (cancelled) return;
      setSnapshot(data as Snapshot | null);
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [user, demoMode]);

  return { snapshot, loading };
}

// Actualiza un campo del perfil propio.
export async function updateProfileField(userId: string, field: string, value: boolean) {
  return supabase.from('profiles').update({ [field]: value }).eq('id', userId);
}
