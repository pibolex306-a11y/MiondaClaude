import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type NowPlayingInfo = {
  now_playing: boolean;
  title: string;
  artist: string;
  cover_url: string | null;
};

export type NowPlayingMap = Map<string, NowPlayingInfo>;

const POLL_INTERVAL = 60_000;
const CACHE_TTL = 60_000;

// Caché compartida por username entre invocaciones del hook
const cache = new Map<string, { info: NowPlayingInfo | null; fetchedAt: number }>();

type Props = {
  // Map de profileId -> { lastfm_username } para perfiles con show_now_playing=true
  usernames: Map<string, string>;
  enabled: boolean;
};

// Consulta "Ahora suena" de Last.fm para un conjunto de perfiles.
// Refresca cada 60 s solo mientras la pestaña está visible. Usa caché para no pasarse del límite de la API.
export function useNowPlaying({ usernames, enabled }: Props) {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingMap>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usernamesRef = useRef(usernames);
  usernamesRef.current = usernames;

  const fetchNowPlaying = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    const current = usernamesRef.current;
    if (current.size === 0) {
      setNowPlaying(new Map());
      return;
    }

    // Filtrar usernames que necesitan refresh (caché expirada o sin caché)
    const now = Date.now();
    const toFetch: { profileId: string; username: string }[] = [];
    const result = new Map<string, NowPlayingInfo>();

    for (const [profileId, username] of current) {
      const cached = cache.get(username);
      if (cached && now - cached.fetchedAt < CACHE_TTL) {
        if (cached.info) result.set(profileId, cached.info);
      } else {
        toFetch.push({ profileId, username });
      }
    }

    if (toFetch.length > 0) {
      const usernameList = toFetch.map((t) => t.username);
      const { data, error } = await supabase.functions.invoke('lastfm-now-playing', {
        body: { usernames: usernameList },
      });

      if (!error && data?.results) {
        const apiResults = data.results as Record<string, NowPlayingInfo | null>;
        for (const { profileId, username } of toFetch) {
          const info = apiResults[username] ?? null;
          cache.set(username, { info, fetchedAt: now });
          if (info) result.set(profileId, info);
        }
      } else {
        // En caso de error, cachear como null para no reintentar de inmediato
        for (const { username } of toFetch) {
          if (!cache.has(username)) cache.set(username, { info: null, fetchedAt: now });
        }
      }
    }

    setNowPlaying(result);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setNowPlaying(new Map());
      return;
    }

    void fetchNowPlaying();

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void fetchNowPlaying();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    intervalRef.current = setInterval(() => void fetchNowPlaying(), POLL_INTERVAL);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [enabled, fetchNowPlaying, usernames]);

  return nowPlaying;
}
