import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const cacheHours = 24 * 7;

type FavoriteRow = { track: { title: string; artist_name: string | null } | null };
type LastFmResponse = {
  error?: number;
  similarartists?: { artist?: Array<{ name?: string; url?: string }> };
  toptracks?: { track?: Array<{ name?: string; url?: string; artist?: { name?: string } }> };
};
type Recommendation = {
  title: string;
  artist_name: string;
  cover_url: string | null;
  preview_url: string | null;
  links: Record<string, string>;
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function lastFm(endpoint: URL, apiKey: string): Promise<LastFmResponse> {
  endpoint.searchParams.set('api_key', apiKey);
  endpoint.searchParams.set('format', 'json');
  const result = await fetch(endpoint);
  if (!result.ok) throw new Error('Last.fm request failed');
  return await result.json() as LastFmResponse;
}

async function enrichRecommendation(title: string, artistName: string, lastfmUrl: string | undefined): Promise<Recommendation> {
  const query = encodeURIComponent(`${title} ${artistName}`);
  const result = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`);
  const payload = result.ok ? await result.json() as { results?: Array<Record<string, unknown>> } : { results: [] };
  const item = payload.results?.[0];
  const links: Record<string, string> = {};
  if (lastfmUrl) links.lastfm = lastfmUrl;
  if (typeof item?.trackViewUrl === 'string') links.itunes = item.trackViewUrl;
  return {
    title,
    artist_name: artistName,
    cover_url: typeof item?.artworkUrl100 === 'string' ? item.artworkUrl100.replace('100x100', '300x300') : null,
    preview_url: typeof item?.previewUrl === 'string' ? item.previewUrl : null,
    links,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authorization = req.headers.get('Authorization');
    const token = authorization?.replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('LASTFM_API_KEY');
    if (!token || !supabaseUrl || !serviceRoleKey) return response({ error: 'Necesitas iniciar sesión para ver recomendaciones.' }, 401);
    if (!apiKey) return response({ error: 'Las recomendaciones de Last.fm aún no están configuradas.' }, 503);

    // Parse body for targetProfileId
    let targetProfileId: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.targetProfileId === 'string') targetProfileId = body.targetProfileId;
    } catch { /* empty body is fine */ }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return response({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' }, 401);

    // Use target profile if provided, otherwise the caller's own profile
    const profileId = targetProfileId || userData.user.id;

    const { data: favorites, error: favoritesError } = await admin
      .from('profile_tracks')
      .select('track:tracks(title, artist_name)')
      .eq('profile_id', profileId)
      .in('kind', ['favorite', 'top3'])
      .limit(12);
    if (favoritesError) return response({ error: 'No pudimos leer las canciones favoritas.' }, 500);

    const rows = (favorites || []) as unknown as FavoriteRow[];
    const normalizedFavorites = rows
      .map((row) => ({ title: row.track?.title?.trim() || '', artist: row.track?.artist_name?.trim() || '' }))
      .filter((favorite) => favorite.title && favorite.artist);
    if (normalizedFavorites.length === 0) return response({ recommendations: [], message: 'Agrega al menos una canción favorita para recibir recomendaciones.' });

    // Build artist signature for cache key (sorted unique artist names)
    const artistNames = [...new Set(normalizedFavorites.map((f) => f.artist))].sort();
    const artistSignature = await hash(JSON.stringify(artistNames));

    // Check cache by artist signature
    const { data: cached } = await admin
      .from('lastfm_recommendation_cache')
      .select('results, expires_at')
      .eq('artist_signature', artistSignature)
      .maybeSingle();
    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return response({ recommendations: cached.results, cached: true });
    }

    const excludedArtists = new Set(artistNames.map((a) => a.toLowerCase()));
    const excludedTrackKeys = new Set(normalizedFavorites.map((f) => `${f.title.toLowerCase()}::${f.artist.toLowerCase()}`));

    // 1. Get similar artists for each favorite artist
    const sourceArtists = artistNames.slice(0, 4);
    const artistResults = await Promise.all(sourceArtists.map(async (artist) => {
      const endpoint = new URL('https://ws.audioscrobbler.com/2.0/');
      endpoint.searchParams.set('method', 'artist.getsimilar');
      endpoint.searchParams.set('artist', artist);
      endpoint.searchParams.set('limit', '5');
      return await lastFm(endpoint, apiKey);
    }));

    // Collect unique similar artists (excluding favorites)
    const similarArtists = new Map<string, string>();
    artistResults.forEach((payload) => {
      payload.similarartists?.artist?.forEach((artist) => {
        const name = artist.name?.trim();
        if (name && !excludedArtists.has(name.toLowerCase()) && !similarArtists.has(name.toLowerCase())) {
          similarArtists.set(name.toLowerCase(), name);
        }
      });
    });

    // 2. For each similar artist, get their top track (limit 1)
    const similarArtistNames = [...similarArtists.values()].slice(0, 10);
    const topTrackResults = await Promise.all(similarArtistNames.map(async (artist) => {
      const endpoint = new URL('https://ws.audioscrobbler.com/2.0/');
      endpoint.searchParams.set('method', 'artist.gettoptracks');
      endpoint.searchParams.set('artist', artist);
      endpoint.searchParams.set('limit', '1');
      return { artistName: artist, result: await lastFm(endpoint, apiKey) };
    }));

    // 3. Build candidates: one track per similar artist
    const candidates: { title: string; artist: string; url?: string }[] = [];
    topTrackResults.forEach(({ artistName, result }) => {
      const topTrack = result.toptracks?.track?.[0];
      if (topTrack?.name) {
        const trackKey = `${topTrack.name.toLowerCase()}::${artistName.toLowerCase()}`;
        if (!excludedTrackKeys.has(trackKey)) {
          candidates.push({ title: topTrack.name, artist: artistName, url: topTrack.url });
        }
      }
    });

    const selected = candidates.slice(0, 10);
    const recommendations = await Promise.all(selected.map((c) => enrichRecommendation(c.title, c.artist, c.url)));
    const expiresAt = new Date(Date.now() + cacheHours * 60 * 60 * 1000).toISOString();
    await admin.from('lastfm_recommendation_cache').upsert({
      artist_signature: artistSignature,
      profile_id: profileId,
      results: recommendations,
      source_signature: artistSignature,
      expires_at: expiresAt,
    });

    return response({ recommendations, cached: false });
  } catch {
    return response({ error: 'Last.fm no está disponible en este momento. Intenta de nuevo más tarde.' }, 502);
  }
});
