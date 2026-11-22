/*
# Puerta de entrada al grupo: código validado en el servidor y aprobación de perfiles

1. Propósito
- Nadie puede ver datos del grupo hasta que canjee el código de acceso.
- El código se guarda como hash SHA-256 en settings (clave 'access_code_hash'),
  invisible para los miembros desde el navegador.
- Cada perfil tiene `approved` que solo el servidor puede poner en true.
  Los admins siempre están aprobados.

2. Cambios de esquema
- profiles.approved boolean NOT NULL DEFAULT false (existentes → true).
- access_code_attempts: tabla para rate-limit de 5 intentos/hora.
- settings: fila 'access_code_hash' con hash del código por defecto.

3. Funciones nuevas
- is_approved(): admin OR approved=true.
- redeem_access_code(p_code): compara hash, aprueba, rate-limit 5/hora.

4. Políticas SELECT actualizadas para exigir is_approved().

5. Seguridad
- El código nunca se envía al cliente. access_code_hash no está en la política pública.
- SECURITY DEFINER con search_path fijado a public, extensions.
- REVOKE de PUBLIC y anon.

6. Notas
- Perfiles existentes aprobados automáticamente. Idempotente.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET approved = true WHERE approved = false;

CREATE TABLE IF NOT EXISTS public.access_code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_code_attempts_user_time
  ON public.access_code_attempts (user_id, attempted_at DESC);

ALTER TABLE public.access_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_code_attempts FROM anon, authenticated;

INSERT INTO public.settings (key, value)
VALUES ('access_code_hash', to_jsonb(encode(extensions.digest('MI-ONDA-2026'::text, 'sha256'::text), 'hex')))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (is_admin OR approved) FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved() TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_access_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_stored_hash text;
  v_input_hash text;
  v_attempt_count int;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT COUNT(*) INTO v_attempt_count
  FROM public.access_code_attempts
  WHERE user_id = v_uid
    AND attempted_at > now() - interval '1 hour';

  IF v_attempt_count >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos. Espera un momento.';
  END IF;

  INSERT INTO public.access_code_attempts (user_id) VALUES (v_uid);

  SELECT value->>0 INTO v_stored_hash
  FROM public.settings
  WHERE key = 'access_code_hash';

  IF v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'El código de acceso no está configurado.';
  END IF;

  v_input_hash := encode(digest(p_code, 'sha256'), 'hex');

  IF v_input_hash = v_stored_hash THEN
    UPDATE public.profiles SET approved = true WHERE id = v_uid;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_access_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(text) TO authenticated;

-- ============================================================
-- Políticas SELECT actualizadas
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR (public.is_approved() AND (is_hidden = false OR auth.uid() = id OR public.is_admin()))
);

DROP POLICY IF EXISTS "profile_artists_select" ON public.profile_artists;
CREATE POLICY "profile_artists_select"
ON public.profile_artists FOR SELECT
TO authenticated
USING (
  public.is_approved()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_artists.profile_id
    AND (p.is_hidden = false OR p.id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "profile_genres_select" ON public.profile_genres;
CREATE POLICY "profile_genres_select"
ON public.profile_genres FOR SELECT
TO authenticated
USING (
  public.is_approved()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_genres.profile_id
    AND (p.is_hidden = false OR p.id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "profile_tracks_select" ON public.profile_tracks;
CREATE POLICY "profile_tracks_select"
ON public.profile_tracks FOR SELECT
TO authenticated
USING (
  public.is_approved()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_tracks.profile_id
    AND (p.is_hidden = false OR p.id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "profile_embeds_select" ON public.profile_embeds;
CREATE POLICY "profile_embeds_select"
ON public.profile_embeds FOR SELECT
TO authenticated
USING (
  public.is_approved()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_embeds.profile_id
    AND (p.is_hidden = false OR p.id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "ai_analyses_select" ON public.ai_analyses;
CREATE POLICY "ai_analyses_select"
ON public.ai_analyses FOR SELECT
TO authenticated
USING (
  public.is_approved()
  AND (
    auth.uid() = profile_id
    OR (is_public = true AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = ai_analyses.profile_id AND p.is_hidden = false
    ))
    OR public.is_admin()
  )
);

DROP POLICY IF EXISTS "similarity_select" ON public.similarity;
CREATE POLICY "similarity_select"
ON public.similarity FOR SELECT
TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "select_challenges" ON public.challenges;
CREATE POLICY "select_challenges"
ON public.challenges FOR SELECT
TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "select_entries" ON public.challenge_entries;
CREATE POLICY "select_entries"
ON public.challenge_entries FOR SELECT
TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "select_likes" ON public.challenge_likes;
CREATE POLICY "select_likes"
ON public.challenge_likes FOR SELECT
TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "genres_select" ON public.genres;
CREATE POLICY "genres_select"
ON public.genres FOR SELECT
TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "artists_select" ON public.artists;
CREATE POLICY "artists_select"
ON public.artists FOR SELECT
TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "tracks_select" ON public.tracks;
CREATE POLICY "tracks_select"
ON public.tracks FOR SELECT
TO authenticated
USING (public.is_approved());

DROP POLICY IF EXISTS "settings_select_public" ON public.settings;
CREATE POLICY "settings_select_public"
ON public.settings FOR SELECT
TO authenticated
USING (
  key IN ('community_rules', 'course_announcement', 'help_texts', 'similarity_weights', 'ai_enabled')
  OR public.is_admin()
);

DROP POLICY IF EXISTS "select_own_plays" ON public.song_plays;
CREATE POLICY "select_own_plays"
ON public.song_plays FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND public.is_approved());
