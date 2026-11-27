// Tipos de la base de datos de Mi Onda.

export type Profile = {
  id: string;
  role: 'miembro' | 'admin';
  display_name: string;
  emoji: string | null;
  cover_url: string | null;
  bio: string | null;
  why_main_artist: string | null;
  theme: string;
  accent: string | null;
  lastfm_username: string | null;
  listenbrainz_username: string | null;
  show_ai_public: boolean;
  is_admin: boolean;
  is_hidden: boolean;
  claimed: boolean;
  suspended: boolean;
  wrapped_opt_in: boolean;
  show_now_playing: boolean;
  approved?: boolean;
  notion_origin: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Artist = {
  id: string;
  name: string;
  name_norm: string;
  image_url: string | null;
  external_ids: Record<string, string>;
};

export type Track = {
  id: string;
  source: 'deezer' | 'itunes' | 'manual';
  external_id: string | null;
  title: string;
  artist_name: string | null;
  artist_id: string | null;
  album_title: string | null;
  cover_url: string | null;
  preview_url: string | null;
  duration_s: number | null;
  isrc: string | null;
  links: Record<string, string>;
  tags: string[];
  is_manual: boolean;
  created_at: string;
};

export type TrackKind = 'top3' | 'favorite' | 'moment';

export type ProfileTrack = {
  id: string;
  profile_id: string;
  track_id: string;
  kind: TrackKind;
  position: number;
  added_via: 'buscar' | 'enlace' | 'lastfm' | 'archivo' | 'lista';
  created_at: string;
  track?: Track;
};

export type ProfileArtist = {
  id: string;
  profile_id: string;
  artist_id: string;
  is_main: boolean;
  position: number;
  artist?: Artist;
};

export type Genre = {
  id: string;
  slug: string;
  label: string;
};

export type ProfileGenre = {
  id: string;
  profile_id: string;
  genre_id: string;
  genre?: Genre;
};

export type ProfileEmbed = {
  id: string;
  profile_id: string;
  kind: 'album' | 'playlist';
  provider: string;
  url: string;
  title: string | null;
  cover_url: string | null;
  position: number;
  created_at: string;
};

export type ProfileStyle = {
  profile_id: string;
  preset: string;
  background: Record<string, unknown>;
  aura: Record<string, unknown>;
  accent: string | null;
  font: string;
  card_shape: string;
  layout: Record<string, unknown>;
  decor: Record<string, unknown>;
  ambient_track_id: string | null;
  saved_looks: unknown[];
  updated_at: string;
};

export type UserSettings = {
  profile_id: string;
  audio: Record<string, unknown>;
  fluidity: string;
  fx_level: string;
  use_my_theme: boolean;
};

export type Similarity = {
  profile_a: string;
  profile_b: string;
  score: number;
  shared: Record<string, unknown>;
  computed_at: string;
};

export type AiAnalysis = {
  id: string;
  profile_id: string;
  content: string;
  model: string | null;
  input_hash: string | null;
  is_public: boolean;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_profile_id: string;
  reason: string;
  status: 'pendiente' | 'revisado' | 'resuelto' | 'desestimado';
  created_at: string;
};

export type Settings = {
  key: string;
  value: unknown;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

// Perfil extendido con relaciones para mostrar en el muro y perfil completo.
export type ProfileWithRelations = Profile & {
  artists?: ProfileArtist[];
  genres?: ProfileGenre[];
  tracks?: ProfileTrack[];
  embeds?: ProfileEmbeds[];
  ai_analysis?: AiAnalysis | null;
  style?: ProfileStyle | null;
};

// Alias para usar en embeds array
type ProfileEmbeds = ProfileEmbed;
