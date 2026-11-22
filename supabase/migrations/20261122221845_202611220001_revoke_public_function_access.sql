/*
# Revocar acceso público a funciones privilegiadas y a la caché de recomendaciones

1. Propósito
- Cerrar tres huecos detectados en la revisión de seguridad:
  a) set_member_role() era ejecutable por anon (sin sesión).
  b) is_admin() era ejecutable por anon.
  c) lastfm_recommendation_cache tenía RLS activado pero sin políticas y con GRANT completo
     a anon y authenticated, dejando la tabla accesible sin restricciones vía Data API.

2. Cambios
- REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, text) FROM PUBLIC, anon.
  Se vuelve a otorgar a authenticated (las políticas la usan internamente y siguen funcionando).
- REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon.
  Se vuelve a otorgar a authenticated (las políticas RLS la invocan).
- REVOKE ALL ON public.lastfm_recommendation_cache FROM anon, authenticated.
  No se crean políticas: la tabla solo la usa la edge function lastfm-recommendations
  con la service role, que omite RLS.

3. Seguridad
- anon ya no puede invocar set_member_role ni is_admin.
- authenticated conserva EXECUTE en ambas funciones, por lo que las políticas RLS
  que dependen de is_admin() siguen funcionando sin cambios.
- lastfm_recommendation_cache queda inaccesible desde el navegador (anon y authenticated).
  Solo la service role puede leerla/escribirla desde la edge function.

4. Notas
- Los datos existentes no se modifican ni se eliminan.
- Esta migración es idempotente: los REVOKE/GRANT se pueden repetir sin error.
*/

REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON public.lastfm_recommendation_cache FROM anon, authenticated;
