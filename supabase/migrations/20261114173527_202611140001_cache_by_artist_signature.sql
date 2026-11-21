/*
# Cache Last.fm recommendations by artist signature instead of per-user

## Changes
- Add `artist_signature` text column to `lastfm_recommendation_cache`.
- Drop the foreign key on `profile_id` (cache is no longer per-user).
- Change primary key from `profile_id` to `artist_signature`.
- Make `profile_id` nullable (kept for traceability only).
- Backfill `artist_signature` from existing `source_signature` so old rows remain valid.

## Notes
- The edge function now stores results keyed by a hash of the source artist set,
  so the same artist combination is shared across all users who have those favorites.
*/

ALTER TABLE lastfm_recommendation_cache
  ADD COLUMN IF NOT EXISTS artist_signature text;

-- Backfill from source_signature before adding NOT NULL constraint
UPDATE lastfm_recommendation_cache
  SET artist_signature = source_signature
  WHERE artist_signature IS NULL;

-- Drop FK and PK that block changing profile_id
ALTER TABLE lastfm_recommendation_cache
  DROP CONSTRAINT IF EXISTS lastfm_recommendation_cache_profile_id_fkey;

ALTER TABLE lastfm_recommendation_cache
  DROP CONSTRAINT lastfm_recommendation_cache_pkey;

-- Make profile_id nullable
ALTER TABLE lastfm_recommendation_cache
  ALTER COLUMN profile_id DROP NOT NULL;

-- Set artist_signature NOT NULL and make it the new PK
ALTER TABLE lastfm_recommendation_cache
  ALTER COLUMN artist_signature SET NOT NULL;

ALTER TABLE lastfm_recommendation_cache
  ADD CONSTRAINT lastfm_recommendation_cache_pkey PRIMARY KEY (artist_signature);
