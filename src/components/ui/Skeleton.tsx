import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function ProfileCardSkeleton() {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-card overflow-hidden">
      <Skeleton className="h-24 w-full rounded-none" />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
