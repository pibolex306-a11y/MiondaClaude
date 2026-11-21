// Cálculo de compatibilidad ("onda") entre dos perfiles musicales.

export type TrackRef = { key: string; display: string };

export type AffinityInput = {
  artists: string[];
  genres: string[];
  favoriteTracks: TrackRef[];
  favoriteCount: number;
};

export type AffinityResult = {
  score: number | null;
  coincidences: string[];
  reason: 'ok' | 'me_needs_favorites' | 'them_needs_favorites';
};

const ARTIST_WEIGHT = 3;
const TRACK_WEIGHT = 2;
const GENRE_WEIGHT = 1;

const norm = (s: string): string => s.toLowerCase().trim();

export function trackKey(title: string, artist: string | null): string {
  return `${title}::${artist ?? ''}`.toLowerCase().trim();
}

export function computeAffinity(me: AffinityInput, them: AffinityInput): AffinityResult {
  if (me.favoriteCount < 2) {
    return { score: null, coincidences: [], reason: 'me_needs_favorites' };
  }
  if (them.favoriteCount < 2) {
    return { score: null, coincidences: [], reason: 'them_needs_favorites' };
  }

  const meArtists = new Set(me.artists.map(norm));
  const themArtists = new Set(them.artists.map(norm));
  const meGenres = new Set(me.genres.map(norm));
  const themGenres = new Set(them.genres.map(norm));
  const meTrackKeys = new Set(me.favoriteTracks.map((t) => t.key));
  const themTrackKeys = new Set(them.favoriteTracks.map((t) => t.key));

  const commonArtistNorms = [...meArtists].filter((a) => themArtists.has(a));
  const commonGenreNorms = [...meGenres].filter((g) => themGenres.has(g));
  const commonTrackKeys = [...meTrackKeys].filter((k) => themTrackKeys.has(k));

  const intersection =
    commonArtistNorms.length * ARTIST_WEIGHT +
    commonTrackKeys.length * TRACK_WEIGHT +
    commonGenreNorms.length * GENRE_WEIGHT;

  const unionArtists = new Set([...meArtists, ...themArtists]);
  const unionGenres = new Set([...meGenres, ...themGenres]);
  const unionTracks = new Set([...meTrackKeys, ...themTrackKeys]);
  const union =
    unionArtists.size * ARTIST_WEIGHT +
    unionTracks.size * TRACK_WEIGHT +
    unionGenres.size * GENRE_WEIGHT;

  const score = union > 0 ? Math.round((intersection / union) * 100) : 0;

  const coincidences: string[] = [];
  const commonArtistSet = new Set(commonArtistNorms);
  for (const a of me.artists) {
    if (commonArtistSet.has(norm(a))) coincidences.push(`Ambos escuchan ${a}`);
    if (coincidences.length >= 3) break;
  }

  if (coincidences.length < 3) {
    const commonTrackSet = new Set(commonTrackKeys);
    for (const t of me.favoriteTracks) {
      if (commonTrackSet.has(t.key)) coincidences.push(`Ambos tienen "${t.display}" como favorita`);
      if (coincidences.length >= 3) break;
    }
  }

  if (coincidences.length < 3) {
    const commonGenreSet = new Set(commonGenreNorms);
    for (const g of me.genres) {
      if (commonGenreSet.has(norm(g))) coincidences.push(`Ambos escuchan ${g}`);
      if (coincidences.length >= 3) break;
    }
  }

  return { score, coincidences: coincidences.slice(0, 3), reason: 'ok' };
}

// Perfil musical de demostración: 3 favoritas, comparte artista con Cris y Valen.
export const DEMO_MY_MUSIC: AffinityInput = {
  artists: ['Duki', 'Bad Bunny', 'Tame Impala'],
  genres: ['Trap', 'Reggaetón', 'Alternative & Indie'],
  favoriteTracks: [
    { key: trackKey('Goteo', 'Duki'), display: 'Goteo' },
    { key: trackKey('Tití Me Preguntó', 'Bad Bunny'), display: 'Tití Me Preguntó' },
    { key: trackKey('Breathe', 'Tame Impala'), display: 'Breathe' },
  ],
  favoriteCount: 3,
};
