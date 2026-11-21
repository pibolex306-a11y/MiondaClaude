import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Music, Search, Sparkles, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONFIG, SEED_ARTISTS } from '@/config/app';
import { normalizeArtistName, validateDisplayName, cn } from '@/lib/utils';
import type { Genre } from '@/types';

type OnboardingData = {
  display_name: string;
  bio: string;
  artist_names: string[];
  main_artist: string;
  favorite_track_title: string;
  favorite_track_artist: string;
  genre_ids: string[];
};

const EMPTY_DATA: OnboardingData = {
  display_name: '',
  bio: '',
  artist_names: [],
  main_artist: '',
  favorite_track_title: '',
  favorite_track_artist: '',
  genre_ids: [],
};

type Props = {
  onComplete: () => void;
};

export function Onboarding({ onComplete }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(EMPTY_DATA);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [artistInput, setArtistInput] = useState('');
  const [trackSearch, setTrackSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar borrador y datos iniciales
  useEffect(() => {
    const draft = localStorage.getItem('mi_onda_onboarding');
    if (draft) {
      try { setData({ ...EMPTY_DATA, ...JSON.parse(draft) }); } catch { /* ignore */ }
    }
    if (profile?.display_name && !data.display_name) {
      setData((d) => ({ ...d, display_name: profile.display_name }));
    }
    // Cargar géneros
    supabase.from('genres').select('*').order('label').then(({ data: g }) => {
      if (g) setGenres(g as Genre[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Guardar borrador en cada cambio
  useEffect(() => {
    localStorage.setItem('mi_onda_onboarding', JSON.stringify(data));
  }, [data]);

  const steps = ['Nombre', 'Artista', 'Canción', 'Géneros'];
  const progress = ((step + 1) / steps.length) * 100;

  function next() {
    setError(null);
    if (step === 0) {
      const err = validateDisplayName(data.display_name);
      if (err) { setError(err); return; }
    }
    if (step === 1) {
      if (data.artist_names.length === 0) { setError('Elige al menos un artista.'); return; }
      if (!data.main_artist) { setError('Marca tu artista principal.'); return; }
    }
    if (step === 2) {
      if (!data.favorite_track_title.trim()) { setError('Escribe el nombre de tu canción favorita.'); return; }
    }
    if (step === 3) {
      if (data.genre_ids.length === 0) { setError('Elige al menos un género.'); return; }
      void finish();
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function addArtist(name: string) {
    const norm = normalizeArtistName(name);
    if (!norm) return;
    setData((d) => {
      const exists = d.artist_names.some((a) => normalizeArtistName(a) === norm);
      if (exists) return d;
      const names = [...d.artist_names, name];
      const main = d.main_artist || names[0];
      return { ...d, artist_names: names, main_artist: main };
    });
  }

  function removeArtist(name: string) {
    setData((d) => {
      const names = d.artist_names.filter((a) => a !== name);
      const main = d.main_artist === name ? names[0] || '' : d.main_artist;
      return { ...d, artist_names: names, main_artist: main };
    });
  }

  function toggleGenre(id: string) {
    setData((d) => {
      if (d.genre_ids.includes(id)) {
        return { ...d, genre_ids: d.genre_ids.filter((g) => g !== id) };
      }
      if (d.genre_ids.length >= APP_CONFIG.maxGenres) return d;
      return { ...d, genre_ids: [...d.genre_ids, id] };
    });
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    setError(null);

    // 1. Actualizar perfil
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ display_name: data.display_name.trim(), bio: data.bio.trim() || null })
      .eq('id', user.id);
    if (profileErr) { setError('No se pudo guardar. Intenta de nuevo.'); setSaving(false); return; }

    // 2. Crear o buscar artistas y enlazar
    for (const name of data.artist_names) {
      const norm = normalizeArtistName(name);
      const { data: existing } = await supabase
        .from('artists')
        .select('id')
        .eq('name_norm', norm)
        .maybeSingle();

      let artistId = existing?.id;
      if (!artistId) {
        const { data: created } = await supabase
          .from('artists')
          .insert({ name: name.trim(), name_norm: norm })
          .select('id')
          .single();
        artistId = created?.id;
      }
      if (!artistId) continue;

      const isMain = name === data.main_artist;
      await supabase
        .from('profile_artists')
        .upsert({ profile_id: user.id, artist_id: artistId, is_main: isMain }, { onConflict: 'profile_id,artist_id' });
    }

    // 3. Crear canción favorita manual
    if (data.favorite_track_title.trim()) {
      const { data: track } = await supabase
        .from('tracks')
        .insert({
          source: 'manual',
          title: data.favorite_track_title.trim(),
          artist_name: data.favorite_track_artist.trim() || null,
          is_manual: true,
        })
        .select('id')
        .single();
      if (track) {
        await supabase
          .from('profile_tracks')
          .insert({ profile_id: user.id, track_id: track.id, kind: 'favorite', position: 0, added_via: 'buscar' });
      }
    }

    // 4. Géneros
    for (const gid of data.genre_ids) {
      await supabase
        .from('profile_genres')
        .upsert({ profile_id: user.id, genre_id: gid }, { onConflict: 'profile_id,genre_id' });
    }

    localStorage.removeItem('mi_onda_onboarding');
    await refreshProfile();
    setSaving(false);
    setStep(4);
  }

  // Pantalla final con confeti
  if (step === 4) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6 animate-scale-in">
            <PartyPopper size={40} className="text-success" />
          </div>
          <h1 className="text-2xl font-bold font-heading mb-2">¡Listo! Tu perfil ya existe</h1>
          <p className="text-text-secondary mb-8">
            Ya eres parte de {APP_CONFIG.name}. Tu página se creó sola en el muro.
          </p>
          <div className="flex flex-col gap-3">
            <Button size="lg" fullWidth onClick={onComplete}>
              Ir al muro
              <ArrowRight size={18} />
            </Button>
            <Button size="lg" variant="secondary" fullWidth onClick={onComplete}>
              Personalizar mi perfil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      {/* Barra de progreso */}
      <div className="safe-top px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-3">
          {step > 0 && (
            <button onClick={back} className="p-2 -ml-2 text-text-secondary hover:text-text-primary pressable rounded-lg">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm text-text-muted tabular-nums">{step + 1}/{steps.length}</span>
        </div>
        <p className="text-sm text-text-secondary">{steps[step]}</p>
      </div>

      {/* Contenido */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        {step === 0 && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold font-heading mb-2">Inscríbete en {APP_CONFIG.name}</h2>
              <p className="text-text-secondary text-sm">
                Llena estos datos en menos de 1 minuto y tu perfil se crea solo. Después puedes personalizarlo.
              </p>
            </div>
            <Input
              label="Tu nombre o apellido"
              hint="Así se llamará tu perfil en el muro."
              placeholder="Ej. Cristhian"
              value={data.display_name}
              onChange={(e) => setData((d) => ({ ...d, display_name: e.target.value }))}
              error={error}
              maxLength={APP_CONFIG.maxNameLength}
              autoFocus
            />
            <Textarea
              label="Sobre ti (opcional)"
              hint="2 o 3 líneas sobre quién eres y qué música te gusta."
              placeholder="Tengo gustos exóticos jaja."
              value={data.bio}
              onChange={(e) => setData((d) => ({ ...d, bio: e.target.value }))}
              maxChars={APP_CONFIG.maxBioLength}
              maxLength={APP_CONFIG.maxBioLength}
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold font-heading mb-2">¿Cuál es tu artista favorito?</h2>
              <p className="text-text-secondary text-sm">
                Elige de la lista. Si el tuyo no aparece, escríbelo abajo.
              </p>
            </div>

            {/* Buscador de artista */}
            <Input
              placeholder="Buscar artista..."
              value={artistInput}
              onChange={(e) => setArtistInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && artistInput.trim()) {
                  e.preventDefault();
                  addArtist(artistInput.trim());
                  setArtistInput('');
                }
              }}
            />

            {/* Chips de sugerencias */}
            <div className="flex flex-wrap gap-2">
              {SEED_ARTISTS
                .filter((a) => !artistInput || a.toLowerCase().includes(artistInput.toLowerCase()))
                .filter((a) => !data.artist_names.includes(a))
                .slice(0, 20)
                .map((artist) => (
                  <Chip key={artist} onClick={() => addArtist(artist)}>
                    {artist}
                  </Chip>
                ))}
            </div>

            {/* Artista manual */}
            {artistInput.trim() && !SEED_ARTISTS.some((a) => a.toLowerCase() === artistInput.toLowerCase()) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { addArtist(artistInput.trim()); setArtistInput(''); }}
              >
                Agregar "{artistInput.trim()}" a mano
              </Button>
            )}

            {/* Artistas seleccionados */}
            {data.artist_names.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-text-secondary">Tus artistas:</p>
                {data.artist_names.map((name) => (
                  <div
                    key={name}
                    className="flex items-center justify-between bg-bg-elevated border border-border-subtle rounded-button px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setData((d) => ({ ...d, main_artist: name }))}
                        className={cn(
                          'w-5 h-5 rounded-full border-2 pressable flex items-center justify-center',
                          data.main_artist === name
                            ? 'bg-accent border-accent'
                            : 'border-border-strong',
                        )}
                        aria-label="Marcar como principal"
                      >
                        {data.main_artist === name && <Check size={12} className="text-white" />}
                      </button>
                      <span className="text-text-primary font-medium">{name}</span>
                      {data.main_artist === name && (
                        <span className="text-xs text-accent font-semibold">Principal</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeArtist(name)}
                      className="text-text-muted hover:text-error pressable text-sm"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <p className="text-xs text-text-muted">Aplasta el círculo para marcar tu artista principal.</p>
              </div>
            )}
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold font-heading mb-2">¿Cuál es tu canción favorita?</h2>
              <p className="text-text-secondary text-sm">
                Escribe el nombre de tu canción favorita. Más adelante puedes buscarla y agregarla con el buscador.
              </p>
            </div>
            <Input
              label="Nombre de la canción"
              placeholder="Ej. TODO CANCION"
              value={data.favorite_track_title}
              onChange={(e) => setData((d) => ({ ...d, favorite_track_title: e.target.value }))}
              error={error}
              autoFocus
            />
            <Input
              label="Artista de la canción (opcional)"
              placeholder="Ej. Duki"
              value={data.favorite_track_artist}
              onChange={(e) => setData((d) => ({ ...d, favorite_track_artist: e.target.value }))}
              hint="Si sabes el artista, escríbelo. Si no, no pasa nada."
            />
            <div className="flex items-center gap-2 p-3 bg-bg-elevated rounded-button border border-border-subtle">
              <Search size={18} className="text-text-muted" />
              <p className="text-xs text-text-secondary">
                Después podrás buscar canciones con preview de 30 segundos desde el catálogo.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold font-heading mb-2">¿Qué géneros te representan más?</h2>
              <p className="text-text-secondary text-sm">
                Elige hasta {APP_CONFIG.maxGenres}. Aplasta los que más te gusten.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <Chip
                  key={g.id}
                  selected={data.genre_ids.includes(g.id)}
                  onClick={() => toggleGenre(g.id)}
                >
                  {g.label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              {data.genre_ids.length}/{APP_CONFIG.maxGenres} seleccionados
            </p>
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        )}
      </div>

      {/* Botón siguiente */}
      <div className="px-6 pb-6 safe-bottom">
        <Button
          size="lg"
          fullWidth
          onClick={next}
          loading={saving}
          disabled={step === 1 && data.artist_names.length === 0}
        >
          {step === steps.length - 1 ? 'Crear mi perfil' : 'Siguiente'}
          {step === steps.length - 1 ? <Sparkles size={18} /> : <ArrowRight size={18} />}
        </Button>
      </div>
    </div>
  );
}
