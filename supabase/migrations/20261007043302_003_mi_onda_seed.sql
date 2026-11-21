/*
# Mi Onda — Datos semilla (géneros, artistas y configuración)

## Descripción
Inserta los 22 géneros y ~95 artistas semilla en la base de datos.
Los géneros ya están limpios (sin "Metallica" ni "Rock; Pop").
Los artistas sirven como sugerencias rápidas (chips) en el onboarding.
Los nombres normalizados permiten agrupar duplicados (mayúsculas, tildes, espacios).
También inserta configuración inicial: reglas de la comunidad, anuncio, IA, pesos.

## Tablas afectadas
- `genres` — 22 filas nuevas
- `artists` — ~95 filas nuevas
- `settings` — 5 filas nuevas
*/

-- ============================================================
-- Géneros semilla (22 limpios)
-- ============================================================
INSERT INTO public.genres (slug, label) VALUES
  ('reggaeton', 'Reggaetón'),
  ('rap-hip-hop', 'Rap/Hip-Hop'),
  ('electronica', 'Electrónica'),
  ('alternative-indie', 'Alternative & Indie'),
  ('rock', 'Rock'),
  ('pop', 'Pop'),
  ('trap', 'Trap'),
  ('metal', 'Metal'),
  ('funk', 'Funk'),
  ('latin', 'Latin'),
  ('rb', 'R&B'),
  ('soul', 'Soul'),
  ('jazz', 'Jazz'),
  ('blues', 'Blues'),
  ('country', 'Country'),
  ('musica-clasica', 'Música clásica'),
  ('salsa', 'Salsa'),
  ('bachata', 'Bachata'),
  ('cumbia', 'Cumbia'),
  ('punk', 'Punk'),
  ('reggae', 'Reggae'),
  ('k-pop', 'K-Pop')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Artistas semilla (~95)
-- ============================================================
INSERT INTO public.artists (name, name_norm) VALUES
  ('Conan Gray', 'conan gray'),
  ('Esperon', 'esperon'),
  ('Kozzo', 'kozzo'),
  ('Milo J', 'milo j'),
  ('Akriila', 'akriila'),
  ('Duki', 'duki'),
  ('Bad Bunny', 'bad bunny'),
  ('Feid', 'feid'),
  ('Karol G', 'karol g'),
  ('Trueno', 'trueno'),
  ('Taylor Swift', 'taylor swift'),
  ('Billie Eilish', 'billie eilish'),
  ('The Weeknd', 'the weeknd'),
  ('Arctic Monkeys', 'arctic monkeys'),
  ('Metallica', 'metallica'),
  ('Twenty One Pilots', 'twenty one pilots'),
  ('Bizarrap', 'bizarrap'),
  ('Quevedo', 'quevedo'),
  ('Rosalía', 'rosalia'),
  ('Rauw Alejandro', 'rauw alejandro'),
  ('Eladio Carrión', 'eladio carrion'),
  ('Mora', 'mora'),
  ('Myke Towers', 'myke towers'),
  ('J Balvin', 'j balvin'),
  ('Daddy Yankee', 'daddy yankee'),
  ('Young Miko', 'young miko'),
  ('Rels B', 'rels b'),
  ('Wos', 'wos'),
  ('YSY A', 'ysy a'),
  ('Nicki Nicole', 'nicki nicole'),
  ('Cazzu', 'cazzu'),
  ('Alvaro Diaz', 'alvaro diaz'),
  ('Blessd', 'blessd'),
  ('Ryan Castro', 'ryan castro'),
  ('Soda Stereo', 'soda stereo'),
  ('Cuarteto de Nos', 'cuarteto de nos'),
  ('Enanitos Verdes', 'enanitos verdes'),
  ('Morat', 'morat'),
  ('Zoé', 'zoe'),
  ('Mon Laferte', 'mon laferte'),
  ('Gustavo Cerati', 'gustavo cerati'),
  ('Olivia Rodrigo', 'olivia rodrigo'),
  ('Dua Lipa', 'dua lipa'),
  ('Harry Styles', 'harry styles'),
  ('Sabrina Carpenter', 'sabrina carpenter'),
  ('Ariana Grande', 'ariana grande'),
  ('Lana Del Rey', 'lana del rey'),
  ('Bruno Mars', 'bruno mars'),
  ('Lady Gaga', 'lady gaga'),
  ('Justin Bieber', 'justin bieber'),
  ('Kendrick Lamar', 'kendrick lamar'),
  ('Travis Scott', 'travis scott'),
  ('Drake', 'drake'),
  ('Eminem', 'eminem'),
  ('Tyler The Creator', 'tyler the creator'),
  ('SZA', 'sza'),
  ('Frank Ocean', 'frank ocean'),
  ('Post Malone', 'post malone'),
  ('Queen', 'queen'),
  ('Coldplay', 'coldplay'),
  ('The Beatles', 'the beatles'),
  ('Nirvana', 'nirvana'),
  ('Radiohead', 'radiohead'),
  ('Imagine Dragons', 'imagine dragons'),
  ('Red Hot Chili Peppers', 'red hot chili peppers'),
  ('Gorillaz', 'gorillaz'),
  ('Linkin Park', 'linkin park'),
  ('Green Day', 'green day'),
  ('Guns N'' Roses', 'guns n roses'),
  ('AC/DC', 'ac/dc'),
  ('The Neighbourhood', 'the neighbourhood'),
  ('Chase Atlantic', 'chase atlantic'),
  ('Cigarettes After Sex', 'cigarettes after sex'),
  ('Shakira', 'shakira'),
  ('Luis Miguel', 'luis miguel'),
  ('Romeo Santos', 'romeo santos'),
  ('Peso Pluma', 'peso pluma'),
  ('Christian Nodal', 'christian nodal'),
  ('Grupo Frontera', 'grupo frontera'),
  ('Ke Personajes', 'ke personajes'),
  ('Avicii', 'avicii'),
  ('Daft Punk', 'daft punk'),
  ('David Guetta', 'david guetta'),
  ('Marshmello', 'marshmello'),
  ('Ramma', 'ramma'),
  ('Natanael Cano', 'natanael cano'),
  ('Tito Double P', 'tito double p'),
  ('Don Omar', 'don omar'),
  ('Wisin y Yandel', 'wisin y yandel'),
  ('Arcángel', 'arcangel'),
  ('De La Ghetto', 'de la ghetto'),
  ('Ovi', 'ovi')
ON CONFLICT (name_norm) DO NOTHING;

-- ============================================================
-- Configuración inicial
-- ============================================================
INSERT INTO public.settings (key, value) VALUES
  ('community_rules', to_jsonb(ARRAY[
    'Respeta los gustos de todos. Nadie se burla de lo que escuchas.',
    'Un perfil por persona. Tu perfil es tu espacio.',
    'Contenido apropiado: sin portadas ni textos subidos de tono.',
    'Si algo no se ve bien, repórtalo. El admin lo revisa.',
    'Los artistas se escriben completos para que se junten con los de los demás.',
    'Si no te sale algo, pide ayuda. Nadie se queda atorado.',
    'No subas archivos de audio al servidor. Tu música se queda en tu teléfono.',
    'Disfruta y comparte tu música con el curso.'
  ])),
  ('course_announcement', to_jsonb('Para participar llena el formulario Inscribirme. Toma menos de un minuto y tu perfil se crea solo.'::text)),
  ('ai_enabled', to_jsonb(true)),
  ('similarity_weights', jsonb_build_object(
    'artists', 40,
    'tracks', 25,
    'genres', 20,
    'tags', 15
  )),
  ('help_texts', jsonb_build_object(
    'personalize', 'No tienes que hacerlo perfecto, solo tienes que hacerlo tuyo. Avanza a tu ritmo, que eso también es creer.',
    'support', 'Si te atascas no te frustres, dime en qué paso te quedaste y lo vemos juntos.'
  ))
ON CONFLICT (key) DO NOTHING;
