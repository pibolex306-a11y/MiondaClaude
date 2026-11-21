const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json() as { usernames?: string[] };
    const usernames = body.usernames?.filter((u) => u && u.length <= 60) ?? [];
    if (usernames.length === 0) {
      return new Response(JSON.stringify({ results: {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (usernames.length > 10) {
      return new Response(JSON.stringify({ error: 'Máximo 10 usuarios por vez.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('LASTFM_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Last.fm no está configurado.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: Record<string, { now_playing: boolean; title: string; artist: string; cover_url: string | null } | null> = {};

    await Promise.all(usernames.map(async (username) => {
      try {
        const endpoint = new URL('https://ws.audioscrobbler.com/2.0/');
        endpoint.searchParams.set('method', 'user.getrecenttracks');
        endpoint.searchParams.set('user', username);
        endpoint.searchParams.set('api_key', apiKey);
        endpoint.searchParams.set('format', 'json');
        endpoint.searchParams.set('limit', '1');

        const response = await fetch(endpoint);
        if (!response.ok) { results[username] = null; return; }
        const payload = await response.json() as {
          error?: number;
          recenttracks?: {
            track?: Array<{
              name?: string;
              artist?: { '#text'?: string };
              image?: Array<{ '#text'?: string; size?: string }>;
              '@attr'?: { nowplaying?: string };
            }>;
          };
        };

        if (payload.error || !payload.recenttracks?.track?.length) {
          results[username] = null;
          return;
        }

        const track = payload.recenttracks.track[0];
        const isNowPlaying = track['@attr']?.nowplaying === 'true';
        if (!isNowPlaying) {
          results[username] = null;
          return;
        }

        const cover = track.image?.find((i) => i.size === 'medium')?.['#text']
          || track.image?.find((i) => i.size === 'small')?.['#text']
          || track.image?.find((i) => i.size === 'large')?.['#text']
          || null;

        results[username] = {
          now_playing: true,
          title: track.name || '',
          artist: track.artist?.['#text'] || '',
          cover_url: cover,
        };
      } catch {
        results[username] = null;
      }
    }));

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'No se pudo consultar Last.fm.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
