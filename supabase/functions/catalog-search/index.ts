const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json() as { query?: string };
    const query = body.query?.trim();
    if (!query || query.length < 2 || query.length > 100) {
      return new Response(JSON.stringify({ error: 'Escribe al menos 2 caracteres.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = new URL('https://itunes.apple.com/search');
    endpoint.searchParams.set('term', query);
    endpoint.searchParams.set('media', 'music');
    endpoint.searchParams.set('entity', 'song');
    endpoint.searchParams.set('limit', '20');
    endpoint.searchParams.set('country', 'MX');

    const response = await fetch(endpoint);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'El catálogo no está disponible.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await response.json() as { results?: Array<Record<string, unknown>> };
    const results = (payload.results || []).map((item) => ({
      external_id: String(item.trackId || ''),
      title: String(item.trackName || ''),
      artist_name: String(item.artistName || ''),
      album_title: String(item.collectionName || ''),
      cover_url: typeof item.artworkUrl100 === 'string' ? item.artworkUrl100.replace('100x100', '600x600') : null,
      preview_url: typeof item.previewUrl === 'string' ? item.previewUrl : null,
      duration_s: typeof item.trackTimeMillis === 'number' ? Math.round(item.trackTimeMillis / 1000) : null,
      source: 'itunes' as const,
      links: typeof item.trackViewUrl === 'string' ? { itunes: item.trackViewUrl } : {},
    })).filter((item) => item.external_id && item.title);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'No se pudo buscar música.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
