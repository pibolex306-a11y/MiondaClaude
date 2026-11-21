import { Sparkles } from 'lucide-react';
import { SimilarMusic } from '@/components/SimilarMusic';

export function Discover() {
  return (
    <div className="min-h-screen px-4 py-6 pb-32">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center"><Sparkles size={20} className="text-accent" /></div>
          <div><h1 className="text-2xl font-bold font-heading">Descubrir</h1><p className="text-sm text-text-secondary">Encuentra música que conecta con tu onda.</p></div>
        </div>
        <SimilarMusic />
      </div>
    </div>
  );
}
