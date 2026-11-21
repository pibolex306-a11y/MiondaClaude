/*
# Mi Onda — Esquema de base de datos (parte 1: tablas y triggers)

## Descripción general
Crea todas las tablas para la app "Mi Onda": perfiles, estilos, ajustes, artistas,
canciones, géneros, embeds, similitud, recomendaciones, análisis IA, reportes,
configuración y auditoría. Los triggers crean un perfil automáticamente al
registrarse un usuario y mantienen updated_at al día.

## Tablas nuevas (16 en total)
1. `profiles` — Perfil de cada miembro
2. `profile_style` — Estilo visual (Estudio de Aura)
3. `user_settings` — Ajustes de audio y fluidez
4. `artists` — Catálogo de artistas con nombre normalizado
5. `tracks` — Catálogo de canciones con preview y enlaces
6. `profile_tracks` — Relación perfil-canción (top3, favorita, momento)
7. `profile_artists` — Relación perfil-artista (principal o no)
8. `genres` — Géneros musicales
9. `profile_genres` — Relación perfil-género
10. `profile_embeds` — Álbumes y playlists destacados
11. `similarity` — Caché de afinidad entre perfiles (0-100)
12. `recommendation_feedback` — Acciones sobre recomendaciones
13. `ai_analyses` — Análisis de IA guardados
14. `reports` — Reportes de contenido
15. `settings` — Configuración global
16. `audit_log` — Registro de acciones del admin

## Notas
- RLS se habilita en todas las tablas.
- Las políticas se crean en una segunda migración (parte 2) porque is_admin()
  necesita que profiles ya exista.
- El trigger on_auth_user_created crea un perfil automáticamente al registrarse.
- El trigger profiles_updated_at mantiene updated_at actualizado.
*/

-- ============================================================
-- 1. profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'miembro' CHECK (role IN ('miembro', 'admin')),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 30),
  emoji text DEFAULT NULL,
  cover_url text DEFAULT NULL,
  bio text DEFAULT NULL CHECK (bio IS NULL OR length(bio) <= 280),
  why_main_artist text DEFAULT NULL CHECK (why_main_artist IS NULL OR length(why_main_artist) <= 400),
  theme text NOT NULL DEFAULT 'oscuro',
  accent text DEFAULT NULL,
  lastfm_username text DEFAULT NULL,
  listenbrainz_username text DEFAULT NULL,
  show_ai_public boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  claimed boolean NOT NULL DEFAULT true,
  suspended boolean NOT NULL DEFAULT false,
  notion_origin jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. profile_style
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_style (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preset text DEFAULT 'neon',
  background jsonb DEFAULT '{}',
  aura jsonb DEFAULT '{}',
  accent text DEFAULT NULL,
  font text DEFAULT 'jakarta',
  card_shape text DEFAULT 'redondeadas',
  layout jsonb DEFAULT '{}',
  decor jsonb DEFAULT '{}',
  ambient_track_id uuid DEFAULT NULL,
  saved_looks jsonb DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. user_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio jsonb DEFAULT '{}',
  fluidity text DEFAULT 'auto',
  fx_level text DEFAULT 'completos',
  use_my_theme boolean DEFAULT false
);

-- ============================================================
-- 4. artists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_norm text NOT NULL UNIQUE,
  image_url text DEFAULT NULL,
  external_ids jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_artists_name_norm ON public.artists(name_norm);
CREATE INDEX IF NOT EXISTS idx_artists_name ON public.artists(name);

-- ============================================================
-- 5. tracks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('deezer', 'itunes', 'manual')),
  external_id text,
  title text NOT NULL,
  artist_name text DEFAULT NULL,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  album_title text DEFAULT NULL,
  cover_url text DEFAULT NULL,
  preview_url text DEFAULT NULL,
  duration_s int DEFAULT NULL,
  isrc text DEFAULT NULL,
  links jsonb DEFAULT '{}',
  tags text[] DEFAULT '{}',
  is_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_tracks_title ON public.tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_name ON public.tracks(artist_name);
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON public.tracks(isrc);

-- ============================================================
-- 6. profile_tracks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('top3', 'favorite', 'moment')),
  position int NOT NULL DEFAULT 0,
  added_via text NOT NULL DEFAULT 'buscar' CHECK (added_via IN ('buscar', 'enlace', 'lastfm', 'archivo', 'lista')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, track_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_profile_tracks_profile ON public.profile_tracks(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_tracks_kind ON public.profile_tracks(kind);

-- ============================================================
-- 7. profile_artists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  is_main boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  UNIQUE(profile_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_artists_profile ON public.profile_artists(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_artists_artist ON public.profile_artists(artist_id);

-- ============================================================
-- 8. genres
-- ============================================================
CREATE TABLE IF NOT EXISTS public.genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL
);

-- ============================================================
-- 9. profile_genres
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  genre_id uuid NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
  UNIQUE(profile_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_genres_profile ON public.profile_genres(profile_id);

-- ============================================================
-- 10. profile_embeds
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_embeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('album', 'playlist')),
  provider text NOT NULL DEFAULT 'spotify',
  url text NOT NULL,
  title text DEFAULT NULL,
  cover_url text DEFAULT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_embeds_profile ON public.profile_embeds(profile_id);

-- ============================================================
-- 11. similarity
-- ============================================================
CREATE TABLE IF NOT EXISTS public.similarity (
  profile_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score int NOT NULL CHECK (score >= 0 AND score <= 100),
  shared jsonb NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_a, profile_b),
  CHECK (profile_a < profile_b)
);

CREATE INDEX IF NOT EXISTS idx_similarity_a ON public.similarity(profile_a);
CREATE INDEX IF NOT EXISTS idx_similarity_b ON public.similarity(profile_b);

-- ============================================================
-- 12. recommendation_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('track', 'artist', 'profile')),
  item_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('dismiss', 'like')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, item_type, item_id, action)
);

CREATE INDEX IF NOT EXISTS idx_rec_feedback_profile ON public.recommendation_feedback(profile_id);

-- ============================================================
-- 13. ai_analyses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  model text DEFAULT NULL,
  input_hash text DEFAULT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_profile ON public.ai_analyses(profile_id);

-- ============================================================
-- 14. reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'revisado', 'resuelto', 'desestimado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- ============================================================
-- 15. settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'
);

-- ============================================================
-- 16. audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text DEFAULT NULL,
  meta jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- ============================================================
-- Habilitar RLS en todas las tablas
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_style ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.similarity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
