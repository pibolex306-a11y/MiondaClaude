/*
# Secure profile access fields

1. Purpose
- Keep profile editing available for normal user-owned content.
- Prevent browser clients from changing privilege, moderation, claim, or ownership fields.

2. Modified table
- `public.profiles`
- User-editable columns remain: display_name, emoji, cover_url, bio, why_main_artist,
  theme, accent, lastfm_username, listenbrainz_username, show_ai_public.
- Protected columns include role, is_admin, is_hidden, claimed, suspended, notion_origin,
  id, created_at, and updated_at.

3. Security changes
- Authenticated clients can no longer insert profiles directly.
- Authenticated clients can update only the user-editable profile columns.
- A SECURITY DEFINER function allows an existing admin to change a member role while
  checking the caller through auth.uid().
- Anonymous clients receive no write permission through these grants.

4. Important notes
- Existing profile rows and their values are preserved.
- The auth trigger remains responsible for creating profiles.
*/

REVOKE INSERT, UPDATE ON public.profiles FROM anon;
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  display_name,
  emoji,
  cover_url,
  bio,
  why_main_artist,
  theme,
  accent,
  lastfm_username,
  listenbrainz_username,
  show_ai_public
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.set_member_role(p_member uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('miembro', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      is_admin = (p_role = 'admin')
  WHERE id = p_member;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, text) TO authenticated;
