/*
# group_summary() SECURITY DEFINER function

Returns aggregate-only group statistics for a date range. Never returns names or individual rows.

## Parameters
- from_date timestamptz: start of range
- to_date timestamptz: end of range

## Returns
- total_people: count of distinct users with wrapped_opt_in = true who have favorites or top tracks
- top_artists: top 5 artists by distinct people count (ties broken by song_plays count), excluding items with 1 person
- top_genres: top 5 genres by distinct people count, excluding items with 1 person
- top_tracks: top 5 tracks by distinct people count, excluding items with 1 person
- challenge_theme: theme of the challenge with most entries in range (null if none)
- challenge_total_entries: total entries for that top challenge (0 if none)

## Security
- SECURITY DEFINER: runs with owner privileges to aggregate across all users
- Callable only by authenticated (REVOKE from PUBLIC/anon)
- Never exposes individual user data, names, or rows
*/

CREATE OR REPLACE FUNCTION group_summary(from_date timestamptz, to_date timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_total_people int;
  v_artists jsonb;
  v_genres jsonb;
  v_tracks jsonb;
  v_challenge_theme text;
  v_challenge_total int;
BEGIN
  -- Total distinct people opted in who have at least one favorite or top track
  SELECT COUNT(DISTINCT pt.profile_id) INTO v_total_people
  FROM profile_tracks pt
  JOIN profiles p ON p.id = pt.profile_id
  WHERE p.wrapped_opt_in = true
    AND pt.kind IN ('favorite', 'top3');

  -- Top 5 artists by distinct people (excluding items with only 1 person)
  -- Ties broken by play count in song_plays
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', artist_name,
      'people', people_count,
      'plays', play_count
    )
    ORDER BY people_count DESC, play_count DESC
  ), '[]'::jsonb) INTO v_artists
  FROM (
    SELECT
      a.name AS artist_name,
      COUNT(DISTINCT pa.profile_id) AS people_count,
      COALESCE(sp.play_count, 0) AS play_count
    FROM profile_artists pa
    JOIN artists a ON a.id = pa.artist_id
    JOIN profiles p ON p.id = pa.profile_id AND p.wrapped_opt_in = true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS play_count
      FROM song_plays sp
      WHERE sp.user_id = pa.profile_id
        AND sp.played_at >= from_date
        AND sp.played_at <= to_date
        AND sp.artist ILIKE a.name
    ) sp ON true
    GROUP BY a.name, sp.play_count
    HAVING COUNT(DISTINCT pa.profile_id) > 1
    LIMIT 5
  ) t;

  -- Top 5 genres by distinct people
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', genre_label,
      'people', people_count
    )
    ORDER BY people_count DESC
  ), '[]'::jsonb) INTO v_genres
  FROM (
    SELECT
      g.label AS genre_label,
      COUNT(DISTINCT pg.profile_id) AS people_count
    FROM profile_genres pg
    JOIN genres g ON g.id = pg.genre_id
    JOIN profiles p ON p.id = pg.profile_id AND p.wrapped_opt_in = true
    GROUP BY g.label
    HAVING COUNT(DISTINCT pg.profile_id) > 1
    LIMIT 5
  ) t;

  -- Top 5 tracks by distinct people
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'title', track_title,
      'artist', track_artist,
      'people', people_count,
      'plays', play_count
    )
    ORDER BY people_count DESC, play_count DESC
  ), '[]'::jsonb) INTO v_tracks
  FROM (
    SELECT
      t.title AS track_title,
      t.artist_name AS track_artist,
      COUNT(DISTINCT pt.profile_id) AS people_count,
      COALESCE(sp.play_count, 0) AS play_count
    FROM profile_tracks pt
    JOIN tracks t ON t.id = pt.track_id
    JOIN profiles p ON p.id = pt.profile_id AND p.wrapped_opt_in = true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS play_count
      FROM song_plays sp
      WHERE sp.user_id = pt.profile_id
        AND sp.played_at >= from_date
        AND sp.played_at <= to_date
        AND sp.title ILIKE t.title
    ) sp ON true
    WHERE pt.kind IN ('favorite', 'top3')
    GROUP BY t.title, t.artist_name, sp.play_count
    HAVING COUNT(DISTINCT pt.profile_id) > 1
    LIMIT 5
  ) t;

  -- Challenge with most entries in range
  SELECT c.theme, COUNT(ce.id)
  INTO v_challenge_theme, v_challenge_total
  FROM challenges c
  JOIN challenge_entries ce ON ce.challenge_id = c.id
  WHERE ce.created_at >= from_date AND ce.created_at <= to_date
  GROUP BY c.theme
  ORDER BY COUNT(ce.id) DESC
  LIMIT 1;

  result := jsonb_build_object(
    'total_people', COALESCE(v_total_people, 0),
    'top_artists', COALESCE(v_artists, '[]'::jsonb),
    'top_genres', COALESCE(v_genres, '[]'::jsonb),
    'top_tracks', COALESCE(v_tracks, '[]'::jsonb),
    'challenge_theme', v_challenge_theme,
    'challenge_total_entries', COALESCE(v_challenge_total, 0)
  );

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION group_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION group_summary(timestamptz, timestamptz) TO authenticated;
