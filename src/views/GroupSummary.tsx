import { useEffect, useState } from 'react';
import { BarChart3, Users, Music, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getCycleKey, getCycleStart, getCycleEnd, currentMonthKey } from '@/lib/wrapped';
import { EmptyState } from '@/components/ui/EmptyState';

type SummaryData = {
  total_people: number;
  top_artists: { name: string; people: number; plays: number }[];
  top_genres: { label: string; people: number }[];
  top_tracks: { title: string; artist: string; people: number; plays: number }[];
  challenge_theme: string | null;
  challenge_total_entries: number;
};

const DEMO_SUMMARY: SummaryData = {
  total_people: 4,
  top_artists: [
    { name: 'Duki', people: 3, plays: 12 },
    { name: 'Bad Bunny', people: 2, plays: 8 },
    { name: 'Tame Impala', people: 2, plays: 5 },
  ],
  top_genres: [
    { label: 'Trap', people: 3 },
    { label: 'Reggaetón', people: 2 },
    { label: 'Indie', people: 2 },
  ],
  top_tracks: [
    { title: 'Goteo', artist: 'Duki', people: 2, plays: 6 },
    { title: 'Tití Me Preguntó', artist: 'Bad Bunny', people: 2, plays: 4 },
  ],
  challenge_theme: 'Canción que te hace llorar',
  challenge_total_entries: 3,
};

export function GroupSummary() {
  const { demoMode } = useAuth();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const cycleKey = getCycleKey(currentMonthKey());
  const cycleStart = getCycleStart(cycleKey);
  const cycleEnd = getCycleEnd(cycleKey);

  useEffect(() => {
    if (demoMode) {
      setData(DEMO_SUMMARY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: result, error } = await supabase.rpc('group_summary', {
        from_date: cycleStart.toISOString(),
        to_date: cycleEnd.toISOString(),
      });
      if (cancelled) return;
      if (error || !result) {
        setData(null);
        setLoading(false);
        return;
      }
      setData(result as SummaryData);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const maxArtistPeople = data ? Math.max(...data.top_artists.map((a) => a.people), 1) : 1;
  const maxGenrePeople = data ? Math.max(...data.top_genres.map((g) => g.people), 1) : 1;
  const monthLabel = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.total_people < 3) {
    return (
      <div className="min-h-screen px-4 py-6 pb-32">
        <div className="max-w-2xl mx-auto">
          <Header monthLabel={monthLabel} />
          <div className="mt-8">
            <EmptyState
              icon={<Users size={40} />}
              title="Aún somos pocos"
              description="Cuando al menos 3 personas participen, aquí verán el artista, la canción y el género más escuchados del grupo. ¡Invita a más gente!"
            />
          </div>
        </div>
      </div>
    );
  }

  const topArtist = data.top_artists[0];
  const topTrack = data.top_tracks[0];
  const topGenre = data.top_genres[0];

  return (
    <div className="min-h-screen px-4 py-6 pb-32">
      <div className="max-w-2xl mx-auto">
        <Header monthLabel={monthLabel} />

        {/* Personas participando */}
        <div className="flex items-center gap-3 bg-bg-surface border border-border-subtle rounded-card p-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
            <Users size={20} className="text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading text-text-primary">{data.total_people}</p>
            <p className="text-xs text-text-secondary">personas participando</p>
          </div>
        </div>

        {/* Destacados del ciclo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {topArtist && (
            <HighlightCard icon={<Music size={16} />} label="Artista más repetido" value={topArtist.name} sub={`${topArtist.people} personas`} />
          )}
          {topTrack && (
            <HighlightCard icon={<Trophy size={16} />} label="Canción top" value={topTrack.title} sub={topTrack.artist} />
          )}
          {topGenre && (
            <HighlightCard icon={<BarChart3 size={16} />} label="Género dominante" value={topGenre.label} sub={`${topGenre.people} personas`} />
          )}
        </div>

        {/* Top 5 artistas en barras */}
        {data.top_artists.length > 0 && (
          <div className="bg-bg-surface border border-border-subtle rounded-card p-4 mb-4">
            <h2 className="text-sm font-bold font-heading mb-3 text-text-primary">Top 5 artistas</h2>
            <div className="flex flex-col gap-2.5">
              {data.top_artists.slice(0, 5).map((a, i) => (
                <BarRow key={i} label={a.name} value={a.people} max={maxArtistPeople} />
              ))}
            </div>
          </div>
        )}

        {/* Top 5 géneros en barras */}
        {data.top_genres.length > 0 && (
          <div className="bg-bg-surface border border-border-subtle rounded-card p-4 mb-4">
            <h2 className="text-sm font-bold font-heading mb-3 text-text-primary">Top 5 géneros</h2>
            <div className="flex flex-col gap-2.5">
              {data.top_genres.slice(0, 5).map((g, i) => (
                <BarRow key={i} label={g.label} value={g.people} max={maxGenrePeople} />
              ))}
            </div>
          </div>
        )}

        {/* Reto destacado */}
        {data.challenge_theme && (
          <div className="bg-bg-surface border border-border-subtle rounded-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} className="text-accent" />
              <p className="text-xs text-text-muted">Reto con más respuestas</p>
            </div>
            <p className="text-sm font-medium text-text-primary">{data.challenge_theme}</p>
            <p className="text-xs text-text-secondary mt-0.5">{data.challenge_total_entries} respuestas</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
        <BarChart3 size={20} className="text-accent" />
      </div>
      <div>
        <h1 className="text-2xl font-bold font-heading">Resumen del grupo</h1>
        <p className="text-sm text-text-secondary capitalize">{monthLabel}</p>
      </div>
    </div>
  );
}

function HighlightCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-card p-3">
      <div className="flex items-center gap-1.5 text-text-muted mb-1.5">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="text-sm font-bold text-text-primary truncate">{value}</p>
      <p className="text-xs text-text-secondary truncate">{sub}</p>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max((value / max) * 100, 4);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-24 sm:w-32 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-bg-elevated rounded-lg overflow-hidden">
        <div className="h-full bg-accent/70 rounded-lg flex items-center px-2 transition-all" style={{ width: `${pct}%` }}>
          <span className="text-[10px] font-bold text-white">{value}</span>
        </div>
      </div>
    </div>
  );
}
