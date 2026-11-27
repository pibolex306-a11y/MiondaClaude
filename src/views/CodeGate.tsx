import { useState } from 'react';
import { KeyRound, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONFIG } from '@/config/app';

// Pantalla que pide el código de acceso al grupo.
// El código se valida en el servidor (redeem_access_code); nunca viaja al navegador.
export function CodeGate() {
  const { redeemCode } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const clean = code.trim();
    if (!clean) {
      setError('Escribe el código de acceso.');
      return;
    }
    setLoading(true);
    try {
      const ok = await redeemCode(clean);
      if (!ok) setError('El código no es válido. Pídeselo a quien te invitó.');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Demasiados intentos')) setError('Demasiados intentos. Espera un momento y vuelve a intentarlo.');
      else setError('No pudimos validar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-card bg-accent/15 flex items-center justify-center mb-4"><KeyRound size={32} className="text-accent" /></div>
          <h1 className="text-3xl font-bold font-heading text-text-primary">{APP_CONFIG.name}</h1>
          <p className="text-text-secondary text-sm mt-1 text-center">Escribe el código de acceso del grupo para entrar.</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="bg-bg-surface border border-border-subtle rounded-card p-6 flex flex-col gap-4">
          <Input
            name="access_code"
            label="Código de acceso"
            placeholder="El código que te compartieron"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={error}
            autoFocus
            autoComplete="off"
          />
          {error && (
            <div className="flex items-start gap-2 text-left bg-error/10 rounded-button p-3">
              <AlertCircle size={16} className="text-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Entrar al grupo <ArrowRight size={18} />
          </Button>
        </form>

        <div className="mt-6 flex items-start gap-2 text-xs text-text-muted">
          <KeyRound size={16} className="flex-shrink-0 mt-0.5" />
          <p>El código es único para el grupo. Si no lo tienes, pídeselo a quien te invitó.</p>
        </div>
      </div>
    </div>
  );
}
