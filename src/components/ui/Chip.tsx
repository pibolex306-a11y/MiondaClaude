import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  color?: string;
};

export function Chip({ children, selected, onClick, className, color }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-chip text-sm font-medium',
        'pressable transition-all duration-150 select-none min-h-[36px]',
        selected
          ? 'bg-accent text-white border border-accent'
          : 'bg-bg-elevated text-text-secondary border border-border-subtle hover:bg-bg-hover hover:text-text-primary',
        className,
      )}
      style={selected && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  );
}
