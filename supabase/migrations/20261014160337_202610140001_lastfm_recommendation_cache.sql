/*
# Last.fm recommendations cache for Phase 3A

1. New table
- `lastfm_recommendation_cache` stores the ten Last.fm-based recommendations for one profile.
- `profile_id` identifies the signed-in profile and is the primary key.
- `results` stores only validated recommendation metadata and preview/link fields.
- `source_signature` identifies the favorites used to create the cache.
- `expires_at` controls the 24-hour refresh window.
- `created_at` records when the cache row was written.

2. Security
- Row Level Security is enabled.
- No browser role receives direct table policies. The server function uses the Supabase service role after validating the caller's session.
- This prevents users from reading or modifying another user's recommendation cache through the Data API.

3. Important notes
- Existing user data is not changed or deleted.
- Expired rows remain harmless cache records and are replaced by the server function on the next request.
*/

CREATE TABLE IF NOT EXISTS public.lastfm_recommendation_cache (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_signature text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lastfm_recommendation_cache_expires
  ON public.lastfm_recommendation_cache (expires_at);

ALTER TABLE public.lastfm_recommendation_cache ENABLE ROW LEVEL SECURITY;
