/*
# Mi Onda — RLS y políticas (parte 2)

## Descripción
Crea la función is_admin() y todas las políticas de Row Level Security
para las 16 tablas creadas en la migración 001_mi_onda_tables.

## Seguridad
- Cada miembro solo edita SU perfil y SUS filas relacionadas.
- Todos los autenticados pueden leer perfiles no ocultos.
- Solo el admin puede leer reportes, audit_log y settings sensibles.
- El admin se reconoce con la función is_admin() que consulta profiles.is_admin.
- Las tablas de catálogo (artists, tracks, genres) son legibles por todos los autenticados.
- 4 políticas por tabla (SELECT, INSERT, UPDATE, DELETE) nunca FOR ALL.
*/

-- ============================================================
-- Función helper: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
TO authenticated
USING (
  is_hidden = false
  OR auth.uid() = id
  OR public.is_admin()
);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- profile_style
-- ============================================================
DROP POLICY IF EXISTS "profile_style_select" ON public.profile_style;
CREATE POLICY "profile_style_select"
ON public.profile_style FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "profile_style_insert_own" ON public.profile_style;
CREATE POLICY "profile_style_insert_own"
ON public.profile_style FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_style_update_own" ON public.profile_style;
CREATE POLICY "profile_style_update_own"
ON public.profile_style FOR UPDATE
TO authenticated
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_style_delete_own" ON public.profile_style;
CREATE POLICY "profile_style_delete_own"
ON public.profile_style FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_style_update_admin" ON public.profile_style;
CREATE POLICY "profile_style_update_admin"
ON public.profile_style FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- user_settings
-- ============================================================
DROP POLICY IF EXISTS "user_settings_select" ON public.user_settings;
CREATE POLICY "user_settings_select"
ON public.user_settings FOR SELECT
TO authenticated
USING (auth.uid() = profile_id OR public.is_admin());

DROP POLICY IF EXISTS "user_settings_insert_own" ON public.user_settings;
CREATE POLICY "user_settings_insert_own"
ON public.user_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "user_settings_update_own" ON public.user_settings;
CREATE POLICY "user_settings_update_own"
ON public.user_settings FOR UPDATE
TO authenticated
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "user_settings_delete_own" ON public.user_settings;
CREATE POLICY "user_settings_delete_own"
ON public.user_settings FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);

-- ============================================================
-- artists
-- ============================================================
DROP POLICY IF EXISTS "artists_select" ON public.artists;
CREATE POLICY "artists_select"
ON public.artists FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "artists_insert" ON public.artists;
CREATE POLICY "artists_insert"
ON public.artists FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "artists_update_admin" ON public.artists;
CREATE POLICY "artists_update_admin"
ON public.artists FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- tracks
-- ============================================================
DROP POLICY IF EXISTS "tracks_select" ON public.tracks;
CREATE POLICY "tracks_select"
ON public.tracks FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "tracks_insert" ON public.tracks;
CREATE POLICY "tracks_insert"
ON public.tracks FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "tracks_update_admin" ON public.tracks;
CREATE POLICY "tracks_update_admin"
ON public.tracks FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- profile_tracks
-- ============================================================
DROP POLICY IF EXISTS "profile_tracks_select" ON public.profile_tracks;
CREATE POLICY "profile_tracks_select"
ON public.profile_tracks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_tracks.profile_id
    AND (p.is_hidden = false OR p.id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "profile_tracks_insert_own" ON public.profile_tracks;
CREATE POLICY "profile_tracks_insert_own"
ON public.profile_tracks FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_tracks_update_own" ON public.profile_tracks;
CREATE POLICY "profile_tracks_update_own"
ON public.profile_tracks FOR UPDATE
TO authenticated
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_tracks_update_admin" ON public.profile_tracks;
CREATE POLICY "profile_tracks_update_admin"
ON public.profile_tracks FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profile_tracks_delete_own" ON public.profile_tracks;
CREATE POLICY "profile_tracks_delete_own"
ON public.profile_tracks FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_tracks_delete_admin" ON public.profile_tracks;
CREATE POLICY "profile_tracks_delete_admin"
ON public.profile_tracks FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- profile_artists
-- ============================================================
DROP POLICY IF EXISTS "profile_artists_select" ON public.profile_artists;
CREATE POLICY "profile_artists_select"
ON public.profile_artists FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_artists.profile_id
    AND (p.is_hidden = false OR p.id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "profile_artists_insert_own" ON public.profile_artists;
CREATE POLICY "profile_artists_insert_own"
ON public.profile_artists FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_artists_update_own" ON public.profile_artists;
CREATE POLICY "profile_artists_update_own"
ON public.profile_artists FOR UPDATE
TO authenticated
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_artists_delete_own" ON public.profile_artists;
CREATE POLICY "profile_artists_delete_own"
ON public.profile_artists FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_artists_delete_admin" ON public.profile_artists;
CREATE POLICY "profile_artists_delete_admin"
ON public.profile_artists FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- genres
-- ============================================================
DROP POLICY IF EXISTS "genres_select" ON public.genres;
CREATE POLICY "genres_select"
ON public.genres FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "genres_insert_admin" ON public.genres;
CREATE POLICY "genres_insert_admin"
ON public.genres FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "genres_update_admin" ON public.genres;
CREATE POLICY "genres_update_admin"
ON public.genres FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "genres_delete_admin" ON public.genres;
CREATE POLICY "genres_delete_admin"
ON public.genres FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- profile_genres
-- ============================================================
DROP POLICY IF EXISTS "profile_genres_select" ON public.profile_genres;
CREATE POLICY "profile_genres_select"
ON public.profile_genres FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_genres.profile_id
    AND (p.is_hidden = false OR p.id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "profile_genres_insert_own" ON public.profile_genres;
CREATE POLICY "profile_genres_insert_own"
ON public.profile_genres FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_genres_delete_own" ON public.profile_genres;
CREATE POLICY "profile_genres_delete_own"
ON public.profile_genres FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_genres_delete_admin" ON public.profile_genres;
CREATE POLICY "profile_genres_delete_admin"
ON public.profile_genres FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- profile_embeds
-- ============================================================
DROP POLICY IF EXISTS "profile_embeds_select" ON public.profile_embeds;
CREATE POLICY "profile_embeds_select"
ON public.profile_embeds FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_embeds.profile_id
    AND (p.is_hidden = false OR p.id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "profile_embeds_insert_own" ON public.profile_embeds;
CREATE POLICY "profile_embeds_insert_own"
ON public.profile_embeds FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_embeds_update_own" ON public.profile_embeds;
CREATE POLICY "profile_embeds_update_own"
ON public.profile_embeds FOR UPDATE
TO authenticated
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_embeds_delete_own" ON public.profile_embeds;
CREATE POLICY "profile_embeds_delete_own"
ON public.profile_embeds FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "profile_embeds_delete_admin" ON public.profile_embeds;
CREATE POLICY "profile_embeds_delete_admin"
ON public.profile_embeds FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- similarity
-- ============================================================
DROP POLICY IF EXISTS "similarity_select" ON public.similarity;
CREATE POLICY "similarity_select"
ON public.similarity FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "similarity_insert_admin" ON public.similarity;
CREATE POLICY "similarity_insert_admin"
ON public.similarity FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "similarity_update_admin" ON public.similarity;
CREATE POLICY "similarity_update_admin"
ON public.similarity FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "similarity_delete_admin" ON public.similarity;
CREATE POLICY "similarity_delete_admin"
ON public.similarity FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- recommendation_feedback
-- ============================================================
DROP POLICY IF EXISTS "rec_feedback_select_own" ON public.recommendation_feedback;
CREATE POLICY "rec_feedback_select_own"
ON public.recommendation_feedback FOR SELECT
TO authenticated
USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "rec_feedback_insert_own" ON public.recommendation_feedback;
CREATE POLICY "rec_feedback_insert_own"
ON public.recommendation_feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "rec_feedback_delete_own" ON public.recommendation_feedback;
CREATE POLICY "rec_feedback_delete_own"
ON public.recommendation_feedback FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);

-- ============================================================
-- ai_analyses
-- ============================================================
DROP POLICY IF EXISTS "ai_analyses_select" ON public.ai_analyses;
CREATE POLICY "ai_analyses_select"
ON public.ai_analyses FOR SELECT
TO authenticated
USING (
  auth.uid() = profile_id
  OR (is_public = true AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = ai_analyses.profile_id AND p.is_hidden = false
  ))
  OR public.is_admin()
);

DROP POLICY IF EXISTS "ai_analyses_insert_own" ON public.ai_analyses;
CREATE POLICY "ai_analyses_insert_own"
ON public.ai_analyses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "ai_analyses_update_own" ON public.ai_analyses;
CREATE POLICY "ai_analyses_update_own"
ON public.ai_analyses FOR UPDATE
TO authenticated
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "ai_analyses_update_admin" ON public.ai_analyses;
CREATE POLICY "ai_analyses_update_admin"
ON public.ai_analyses FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_analyses_delete_own" ON public.ai_analyses;
CREATE POLICY "ai_analyses_delete_own"
ON public.ai_analyses FOR DELETE
TO authenticated
USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "ai_analyses_delete_admin" ON public.ai_analyses;
CREATE POLICY "ai_analyses_delete_admin"
ON public.ai_analyses FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- reports
-- ============================================================
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "reports_select"
ON public.reports FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id OR public.is_admin());

DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin"
ON public.reports FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- settings
-- ============================================================
DROP POLICY IF EXISTS "settings_select_public" ON public.settings;
CREATE POLICY "settings_select_public"
ON public.settings FOR SELECT
TO authenticated
USING (
  key IN ('community_rules', 'course_announcement', 'help_texts', 'similarity_weights', 'ai_enabled')
  OR public.is_admin()
);

DROP POLICY IF EXISTS "settings_upsert_admin" ON public.settings;
CREATE POLICY "settings_upsert_admin"
ON public.settings FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin"
ON public.settings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_delete_admin" ON public.settings;
CREATE POLICY "settings_delete_admin"
ON public.settings FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- audit_log
-- ============================================================
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "audit_log_insert_admin" ON public.audit_log;
CREATE POLICY "audit_log_insert_admin"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());
