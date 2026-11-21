/*
# Mi Onda history tables and profile settings

## New Tables
- `music_snapshots`: monthly music summary per user (artists, tracks, genres, favorites). Unique per user+month.
- `song_plays`: log of song plays (for group analytics and play counts). One row per play.
- `challenges`: weekly challenge definitions (theme, date range, creator). Admin-only create/edit.
- `challenge_entries`: one entry per user per challenge (song submission + note). Unique per challenge+user.
- `challenge_likes`: like on an entry, unique per entry+user pair.

## Modified Tables
- `profiles`: add `wrapped_opt_in` (boolean, default true) and `show_now_playing` (boolean, default false).
- `profile_tracks`: add `added_at` (timestamptz, default now()) for tracking when a favorite was added.

## Security
- `music_snapshots`: owner-only CRUD (authenticated, auth.uid() = user_id).
- `song_plays`: owner-only CRUD (authenticated, auth.uid() = user_id).
- `challenges`: readable by all authenticated; only admins can insert/update/delete (checked via profiles.is_admin).
- `challenge_entries`: readable by all authenticated; owner-only insert/update/delete.
- `challenge_likes`: readable by all authenticated; owner-only insert/delete.
- `group_summary()` function: SECURITY DEFINER, callable by authenticated. Returns aggregates only.

## Cascade
- All new user-scoped tables have ON DELETE CASCADE referencing auth.users(id) or profiles(id).
- Deleting a challenge cascades to its entries and likes.
- Deleting an entry cascades to its likes.
*/

-- 1. profile_tracks: add added_at
ALTER TABLE profile_tracks
  ADD COLUMN IF NOT EXISTS added_at timestamptz DEFAULT now();

-- 2. profiles: add wrapped_opt_in and show_now_playing
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wrapped_opt_in boolean NOT NULL DEFAULT true;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_now_playing boolean NOT NULL DEFAULT false;

-- 3. music_snapshots
CREATE TABLE IF NOT EXISTS music_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  top_artists jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_genres jsonb NOT NULL DEFAULT '[]'::jsonb,
  favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'app',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_key)
);

ALTER TABLE music_snapshots ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON music_snapshots TO authenticated;

DROP POLICY IF EXISTS "select_own_snapshots" ON music_snapshots;
CREATE POLICY "select_own_snapshots" ON music_snapshots FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_snapshots" ON music_snapshots;
CREATE POLICY "insert_own_snapshots" ON music_snapshots FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_snapshots" ON music_snapshots;
CREATE POLICY "update_own_snapshots" ON music_snapshots FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_snapshots" ON music_snapshots;
CREATE POLICY "delete_own_snapshots" ON music_snapshots FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 4. song_plays
CREATE TABLE IF NOT EXISTS song_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_key text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  played_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE song_plays ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON song_plays TO authenticated;

DROP POLICY IF EXISTS "select_own_plays" ON song_plays;
CREATE POLICY "select_own_plays" ON song_plays FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_plays" ON song_plays;
CREATE POLICY "insert_own_plays" ON song_plays FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_plays" ON song_plays;
CREATE POLICY "update_own_plays" ON song_plays FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_plays" ON song_plays;
CREATE POLICY "delete_own_plays" ON song_plays FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_song_plays_user_played_at ON song_plays (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_song_plays_track_key ON song_plays (track_key);

-- 5. challenges
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key text NOT NULL UNIQUE,
  theme text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON challenges TO authenticated;
GRANT INSERT, UPDATE, DELETE ON challenges TO authenticated;

DROP POLICY IF EXISTS "select_challenges" ON challenges;
CREATE POLICY "select_challenges" ON challenges FOR SELECT
  TO authenticated USING (true);

-- Admin-only insert/update/delete (checks profiles.is_admin via SECURITY DEFINER-free subquery)
DROP POLICY IF EXISTS "admin_insert_challenges" ON challenges;
CREATE POLICY "admin_insert_challenges" ON challenges FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
DROP POLICY IF EXISTS "admin_update_challenges" ON challenges;
CREATE POLICY "admin_update_challenges" ON challenges FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
DROP POLICY IF EXISTS "admin_delete_challenges" ON challenges;
CREATE POLICY "admin_delete_challenges" ON challenges FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 6. challenge_entries
CREATE TABLE IF NOT EXISTS challenge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text NOT NULL,
  cover_url text,
  preview_url text,
  source_url text,
  note text CHECK (char_length(note) <= 140),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE challenge_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON challenge_entries TO authenticated;

DROP POLICY IF EXISTS "select_entries" ON challenge_entries;
CREATE POLICY "select_entries" ON challenge_entries FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_own_entry" ON challenge_entries;
CREATE POLICY "insert_own_entry" ON challenge_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_entry" ON challenge_entries;
CREATE POLICY "update_own_entry" ON challenge_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_entry" ON challenge_entries;
CREATE POLICY "delete_own_entry" ON challenge_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 7. challenge_likes
CREATE TABLE IF NOT EXISTS challenge_likes (
  entry_id uuid NOT NULL REFERENCES challenge_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id)
);

ALTER TABLE challenge_likes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON challenge_likes TO authenticated;

DROP POLICY IF EXISTS "select_likes" ON challenge_likes;
CREATE POLICY "select_likes" ON challenge_likes FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_own_like" ON challenge_likes;
CREATE POLICY "insert_own_like" ON challenge_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_like" ON challenge_likes;
CREATE POLICY "delete_own_like" ON challenge_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
