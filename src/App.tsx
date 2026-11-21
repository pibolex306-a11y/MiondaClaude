import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useHistorySync } from '@/hooks/useHistorySync';
import { Login } from '@/views/Login';
import { Onboarding } from '@/views/Onboarding';
import { Wall } from '@/views/Wall';
import { ProfileView } from '@/views/ProfileView';
import { Search } from '@/views/Search';
import { Discover } from '@/views/Discover';
import { GroupSummary } from '@/views/GroupSummary';
import { WeeklyChallenge } from '@/views/WeeklyChallenge';
import { BottomNav, type Tab } from '@/components/BottomNav';
import { MiniPlayer } from '@/components/MiniPlayer';

function AppContent() {
  const { user, profile, loading, demoMode, enterDemo, exitDemo } = useAuth();
  const [tab, setTab] = useState<Tab>('muro');
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const previewMode = demoMode;

  // Sincronizar snapshots mensuales y registrar reproducciones
  useHistorySync();

  // Si el perfil no tiene display_name real (auto-creado con el correo), mostrar onboarding
  const needsOnboarding = user && profile && (
    !profile.display_name ||
    profile.display_name === user.email?.split('@')[0] ||
    profile.display_name.length < 2
  );

  // Reset profile view when changing tabs
  useEffect(() => {
    if (tab !== 'muro') setViewingProfileId(null);
  }, [tab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !previewMode) {
    return <Login onDemo={enterDemo} />;
  }

  if (needsOnboarding) {
    return <Onboarding onComplete={() => setTab('muro')} />;
  }

  // Ver perfil de alguien
  if (viewingProfileId) {
    return (
      <div className="min-h-screen bg-bg-base">
        {previewMode && <DemoBanner onExit={() => void exitDemo()} />}
        <ProfileView profileId={viewingProfileId} preview={previewMode} onBack={() => setViewingProfileId(null)} onNavigate={(t) => setTab(t)} />
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <MiniPlayer />
          <BottomNav active={tab} onChange={setTab} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      {previewMode && <DemoBanner onExit={() => void exitDemo()} />}
      {tab === 'muro' && <Wall preview={previewMode} onOpenProfile={setViewingProfileId} />}
      {tab === 'buscar' && <Search />}
      {tab === 'descubrir' && <Discover />}
      {tab === 'reto' && <WeeklyChallenge />}
      {tab === 'resumen' && <GroupSummary />}
      {tab === 'perfil' && (
        <ProfileView profileId={user?.id || 'preview-cris'} preview={previewMode} onBack={() => setTab('muro')} />
      )}

      {/* Mini-reproductor + barra inferior */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <MiniPlayer />
        <BottomNav active={tab} onChange={setTab} />
      </div>
    </div>
  );
}

function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-warning px-4 py-2 text-xs font-semibold text-black safe-top">
      <span>MODO DEMO</span>
      <button onClick={onExit} className="rounded-full border border-black/30 px-3 py-1 hover:bg-black/10">Salir del demo</button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
