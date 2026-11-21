// Configuración central de Mi Onda.
// Si ves "1ro Vespertino" en algún lado sin reemplazar, el nombre real es este.
export const APP_CONFIG = {
  name: 'Mi Onda',
  DEMO_ENABLED: true,
  tagline: 'Comparte la música que te mueve',
  // El correo del admin inicial se define en el servidor (variable de entorno),
  // nunca aquí ni en el cliente.
  maxBioLength: 280,
  maxWhyArtistLength: 400,
  minNameLength: 2,
  maxNameLength: 30,
  maxGenres: 3,
  maxEmbeds: 5,
  minTracksForAI: 2,
  aiCooldownHours: 24,
  coverMaxBytes: 2 * 1024 * 1024, // 2 MB
} as const;

// Géneros semilla (22, ya limpios: "Metallica" → Metal, "Rock; Pop" → dividido).
export const SEED_GENRES = [
  'Reggaetón', 'Rap/Hip-Hop', 'Electrónica', 'Alternative & Indie', 'Rock',
  'Pop', 'Trap', 'Metal', 'Funk', 'Latin', 'R&B', 'Soul', 'Jazz', 'Blues',
  'Country', 'Música clásica', 'Salsa', 'Bachata', 'Cumbia', 'Punk', 'Reggae',
  'K-Pop',
] as const;

// Artistas semilla (sugerencias como chips; la búsqueda real es ilimitada).
export const SEED_ARTISTS = [
  'Conan Gray', 'Esperon', 'Kozzo', 'Milo J', 'Akriila', 'Duki', 'Bad Bunny',
  'Feid', 'Karol G', 'Trueno', 'Taylor Swift', 'Billie Eilish', 'The Weeknd',
  'Arctic Monkeys', 'Metallica', 'Twenty One Pilots', 'Bizarrap', 'Quevedo',
  'Rosalía', 'Rauw Alejandro', 'Eladio Carrión', 'Mora', 'Myke Towers',
  'J Balvin', 'Daddy Yankee', 'Young Miko', 'Rels B', 'Wos', 'YSY A',
  'Nicki Nicole', 'Cazzu', 'Alvaro Diaz', 'Blessd', 'Ryan Castro',
  'Soda Stereo', 'Cuarteto de Nos', 'Enanitos Verdes', 'Morat', 'Zoé',
  'Mon Laferte', 'Gustavo Cerati', 'Olivia Rodrigo', 'Dua Lipa',
  'Harry Styles', 'Sabrina Carpenter', 'Ariana Grande', 'Lana Del Rey',
  'Bruno Mars', 'Lady Gaga', 'Justin Bieber', 'Kendrick Lamar',
  'Travis Scott', 'Drake', 'Eminem', 'Tyler The Creator', 'SZA',
  'Frank Ocean', 'Post Malone', 'Queen', 'Coldplay', 'The Beatles',
  'Nirvana', 'Radiohead', 'Imagine Dragons', 'Red Hot Chili Peppers',
  'Gorillaz', 'Linkin Park', 'Green Day', "Guns N' Roses", 'AC/DC',
  'The Neighbourhood', 'Chase Atlantic', 'Cigarettes After Sex',
  'Shakira', 'Luis Miguel', 'Romeo Santos', 'Peso Pluma', 'Christian Nodal',
  'Grupo Frontera', 'Ke Personajes', 'Avicii', 'Daft Punk', 'David Guetta',
  'Marshmello', 'Ramma', 'Natanael Cano', 'Tito Double P', 'Don Omar',
  'Wisin y Yandel', 'Arcángel', 'De La Ghetto', 'Ovi',
] as const;

// Mensaje de invitación al grupo (botón "Invitar" lo copia).
export const INVITE_MESSAGE =
  '¡Hola! Armé una app donde podemos ver la música favorita de cada uno de nuestro grupo. ' +
  'Solo toma 1 minuto: entra al enlace, llena el formulario y tu perfil se crea solo. ' +
  'Lo demás es opcional. [enlace]';

// Frases de la wiki original.
export const PHRASES = {
  personalizeSupport: 'No tienes que hacerlo perfecto, solo tienes que hacerlo tuyo. Avanza a tu ritmo, que eso también es creer.',
  helpSupport: 'Si te atascas no te frustres, dime en qué paso te quedaste y lo vemos juntos.',
} as const;
