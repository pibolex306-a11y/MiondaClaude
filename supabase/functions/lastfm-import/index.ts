const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json() as { username?: string; limit?: number };
    const username = body.username?.trim();
    const apiKey = Deno.env.get('LASTFM_API_KEY');
    if (!username || username.length > 60) return new Response(JSON.stringify({ error: 'Escribe un usuario válido.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!apiKey) return new Response(JSON.stringify({ error: 'La importación de Last.fm aún no está configurada.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const endpoint = new URL('https://ws.audioscrobbler.com/2.0/');
    endpoint.searchParams.set('method', 'user.gettoptracks');
    endpoint.searchParams.set('user', username);
    endpoint.searchParams.set('api_key', apiKey);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('limit', String(Math.min(Math.max(body.limit || 10, 1), 25)));
    const response = await fetch(endpoint);
    if (!response.ok) return new Response(JSON.stringify({ error: 'Last.fm no respondió.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const payload = await response.json() as { error?: number; message?: string; toptracks?: { track?: Array<Record<string, unknown>> } };
    if (payload.error) return new Response(JSON.stringify({ error: 'No encontramos ese usuario de Last.fm.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const tracks = (payload.toptracks?.track || []).map((track) => ({ title: typeof track.name === 'string' ? track.name : '', artist_name: typeof (track.artist as { name?: unknown } | undefined)?.name === 'string' ? (track.artist as { name: string }).name : '', source: 'manual' as const, external_id: null, album_title: null, cover_url: null, preview_url: null, duration_s: null, links: typeof track.url === 'string' ? { lastfm: track.url } : {} })).filter((track) => track.title && track.artist_name);
    return new Response(JSON.stringify({ username, tracks }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'No pudimos importar Last.fm.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
