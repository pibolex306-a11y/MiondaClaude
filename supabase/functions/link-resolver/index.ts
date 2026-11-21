const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const providers = [
  { host: 'open.spotify.com', endpoint: 'https://open.spotify.com/oembed?url=' },
  { host: 'www.youtube.com', endpoint: 'https://www.youtube.com/oembed?format=json&url=' },
  { host: 'youtu.be', endpoint: 'https://www.youtube.com/oembed?format=json&url=' },
  { host: 'soundcloud.com', endpoint: 'https://soundcloud.com/oembed?format=json&url=' },
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json() as { url?: string };
    const rawUrl = body.url?.trim();
    if (!rawUrl || rawUrl.length > 500) return new Response(JSON.stringify({ error: 'Enlace inválido.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const url = new URL(rawUrl);
    const provider = providers.find((item) => item.host === url.hostname.toLowerCase());
    if (!provider) return new Response(JSON.stringify({ error: 'Este proveedor todavía no está disponible.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const response = await fetch(`${provider.endpoint}${encodeURIComponent(url.toString())}`);
    if (!response.ok) return new Response(JSON.stringify({ error: 'No pudimos leer ese enlace.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const data = await response.json() as Record<string, unknown>;
    return new Response(JSON.stringify({ provider: provider.host, url: url.toString(), kind: 'playlist', title: typeof data.title === 'string' ? data.title : null, cover_url: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null, author: typeof data.author_name === 'string' ? data.author_name : null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'No pudimos procesar ese enlace.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
