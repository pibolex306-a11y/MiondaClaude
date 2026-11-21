import { Home, Search, Sparkles, User, BarChart3, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tab = 'muro' | 'buscar' | 'descubrir' | 'reto' | 'resumen' | 'perfil';

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export function BottomNav({ active, onChange }: Props) {
  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: 'muro', label: 'Muro', icon: Home },
    { id: 'buscar', label: 'Buscar', icon: Search },
    { id: 'descubrir', label: 'Descubrir', icon: Sparkles },
    { id: 'reto', label: 'Reto', icon: Trophy },
    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-border-subtle safe-bottom">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 sm:px-3 min-h-[56px] min-w-0 flex-1 pressable transition-colors',
              active === id ? 'text-accent' : 'text-text-muted hover:text-text-secondary',
            )}
            aria-label={label}
            aria-current={active === id ? 'page' : undefined}
          >
            <Icon size={20} />
            <span className="text-[10px] sm:text-xs font-medium truncate max-w-full">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
