import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { trackKey } from '@/lib/affinity';
import type { Profile, ProfileTrack, Track } from '@/types';

// Perfil extendido para mostrar en el muro y página de perfil.
export type WallProfile = Profile & {
  main_artist_name: string | null;
  all_artist_names: string[];
  genre_labels: string[];
  favorite_track: Track | null;
  track_count: number;
  favorite_track_keys: { key: string; display: string }[];
  favorite_count: number;
};

const PREVIEW_TRACKS: Track[] = [
  { id: 'preview-track-1', source: 'manual', external_id: null, title: 'Goteo', artist_name: 'Duki', artist_id: null, album_title: null, cover_url: null, preview_url: null, duration_s: null, isrc: null, links: {}, tags: [], is_manual: true, created_at: new Date().toISOString() },
  { id: 'preview-track-2', source: 'manual', external_id: null, title: 'Tití Me Preguntó', artist_name: 'Bad Bunny', artist_id: null, album_title: null, cover_url: null, preview_url: null, duration_s: null, isrc: null, links: {}, tags: [], is_manual: true, created_at: new Date().toISOString() },
  { id: 'preview-track-3', source: 'manual', external_id: null, title: 'Happier Than Ever', artist_name: 'Billie Eilish', artist_id: null, album_title: null, cover_url: null, preview_url: null, duration_s: null, isrc: null, links: {}, tags: [], is_manual: true, created_at: new Date().toISOString() },
];

const PREVIEW_PROFILES: WallProfile[] = [
  { id: 'preview-cris', role: 'miembro', display_name: 'Cris', emoji: '🔥', cover_url: null, bio: 'Tengo gustos exóticos jaja. Vivo el trap argentino 24/7.', why_main_artist: null, theme: 'oscuro', accent: null, lastfm_username: null, listenbrainz_username: null, show_ai_public: false, is_admin: false, is_hidden: false, claimed: false, suspended: false, wrapped_opt_in: true, show_now_playing: true, notion_origin: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), main_artist_name: 'Duki', all_artist_names: ['Duki', 'Trueno'], genre_labels: ['Trap', 'Rap/Hip-Hop'], favorite_track: PREVIEW_TRACKS[0], track_count: 2, favorite_track_keys: [{ key: trackKey('Goteo', 'Duki'), display: 'Goteo' }, { key: trackKey('Flow 2020', 'Duki'), display: 'Flow 2020' }], favorite_count: 2 },
  { id: 'preview-valen', role: 'miembro', display_name: 'Valen', emoji: '🎧', cover_url: null, bio: 'No puedo parar de escuchar reggaetón. Bad Bunny es vida.', why_main_artist: null, theme: 'oscuro', accent: null, lastfm_username: 'demo_valen', listenbrainz_username: null, show_ai_public: false, is_admin: false, is_hidden: false, claimed: false, suspended: false, wrapped_opt_in: true, show_now_playing: true, notion_origin: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), main_artist_name: 'Bad Bunny', all_artist_names: ['Bad Bunny', 'Taylor Swift'], genre_labels: ['Reggaetón', 'Pop'], favorite_track: PREVIEW_TRACKS[1], track_count: 2, favorite_track_keys: [{ key: trackKey('Tití Me Preguntó', 'Bad Bunny'), display: 'Tití Me Preguntó' }, { key: trackKey('Me Porto Bonito', 'Bad Bunny'), display: 'Me Porto Bonito' }], favorite_count: 2 },
  { id: 'preview-sofi', role: 'miembro', display_name: 'Sofi', emoji: '🌙', cover_url: null, bio: 'Amo todo lo raro y experimental. Billie es mi diosa.', why_main_artist: null, theme: 'oscuro', accent: null, lastfm_username: null, listenbrainz_username: null, show_ai_public: false, is_admin: false, is_hidden: false, claimed: false, suspended: false, wrapped_opt_in: true, show_now_playing: false, notion_origin: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), main_artist_name: 'Billie Eilish', all_artist_names: ['Billie Eilish', 'Taylor Swift'], genre_labels: ['Alternative & Indie', 'Pop'], favorite_track: PREVIEW_TRACKS[2], track_count: 2, favorite_track_keys: [{ key: trackKey('Happier Than Ever', 'Billie Eilish'), display: 'Happier Than Ever' }, { key: trackKey('Bellyache', 'Billie Eilish'), display: 'Bellyache' }], favorite_count: 2 },
];

export function useWallProfiles(preview = false) {
  const [profiles, setProfiles] = useState<WallProfile[]>(preview ? PREVIEW_PROFILES : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (preview) {
      setProfiles(PREVIEW_PROFILES);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Perfiles no ocultos ni suspendidos
    const { data: rawProfiles, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_hidden', false)
      .eq('suspended', false)
      .order('updated_at', { ascending: false });
    if (pErr) { setError('No se pudo cargar el muro.'); setLoading(false); return; }
    if (!rawProfiles || rawProfiles.length === 0) { setProfiles([]); setLoading(false); return; }

    const profileIds = rawProfiles.map((p) => p.id);

    // 2. Artistas de cada perfil
    const { data: paRows } = await supabase
      .from('profile_artists')
      .select('profile_id, is_main, artist:artists(name)')
      .in('profile_id', profileIds);
    const paMap = new Map<string, { name: string; is_main: boolean }[]>();
    (paRows as unknown as { profile_id: string; is_main: boolean; artist: { name: string } }[] | null)?.forEach((r) => {
      const arr = paMap.get(r.profile_id) || [];
      arr.push({ name: r.artist.name, is_main: r.is_main });
      paMap.set(r.profile_id, arr);
    });

    // 3. Géneros de cada perfil
    const { data: pgRows } = await supabase
      .from('profile_genres')
      .select('profile_id, genre:genres(label)')
      .in('profile_id', profileIds);
    const pgMap = new Map<string, string[]>();
    (pgRows as unknown as { profile_id: string; genre: { label: string } }[] | null)?.forEach((r) => {
      const arr = pgMap.get(r.profile_id) || [];
      arr.push(r.genre.label);
      pgMap.set(r.profile_id, arr);
    });

    // 4. Canciones favoritas (todas las favoritas para afinidad + la primera para mostrar)
    const { data: ptRows } = await supabase
      .from('profile_tracks')
      .select('profile_id, kind, track:tracks(*)')
      .in('profile_id', profileIds);
    const favMap = new Map<string, Track | null>();
    const favKeysMap = new Map<string, { key: string; display: string }[]>();
    const countMap = new Map<string, number>();
    (ptRows as unknown as { profile_id: string; kind: string; track: Track }[] | null)?.forEach((r) => {
      if (r.kind === 'favorite') {
        if (!favMap.has(r.profile_id)) favMap.set(r.profile_id, r.track);
        const arr = favKeysMap.get(r.profile_id) || [];
        arr.push({ key: trackKey(r.track.title, r.track.artist_name), display: r.track.title });
        favKeysMap.set(r.profile_id, arr);
      }
      countMap.set(r.profile_id, (countMap.get(r.profile_id) || 0) + 1);
    });

    // 5. Ensamblar
    const wall: WallProfile[] = rawProfiles.map((p) => {
      const artists = paMap.get(p.id) || [];
      const main = artists.find((a) => a.is_main);
      return {
        ...(p as Profile),
        main_artist_name: main?.name ?? artists[0]?.name ?? null,
        all_artist_names: artists.map((a) => a.name),
        genre_labels: pgMap.get(p.id) || [],
        favorite_track: favMap.get(p.id) || null,
        track_count: countMap.get(p.id) || 0,
        favorite_track_keys: favKeysMap.get(p.id) || [],
        favorite_count: favKeysMap.get(p.id)?.length || 0,
      };
    });

    setProfiles(wall);
    setLoading(false);
  }, [preview]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { profiles, loading, error, refetch: fetch };
}
