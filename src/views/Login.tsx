import { useEffect, useRef, useState } from 'react';
import { Music, Mail, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { APP_CONFIG } from '@/config/app';

type LoginProps = { onDemo?: () => void };

export function Login({ onDemo }: LoginProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '', '', '']);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  function getAuthError(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes('rate limit') || normalized.includes('too many')) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
    if (normalized.includes('expired') || normalized.includes('invalid') || normalized.includes('token')) return 'El código es incorrecto o venció. Pide uno nuevo.';
    return 'No pudimos completar el acceso. Intenta de nuevo.';
  }

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Escribe un correo válido.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({ email: cleanEmail });
    setLoading(false);
    if (authError) {
      setError(getAuthError(authError.message));
      return;
    }
    setStep('code');
    setCode(['', '', '', '', '', '', '', '']);
    setCountdown(60);
    setTimeout(() => codeRefs.current[0]?.focus(), 0);
  }

  function updateCode(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 7) codeRefs.current[index + 1]?.focus();
  }

  function handleCodeKey(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !code[index] && index > 0) codeRefs.current[index - 1]?.focus();
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const token = code.join('');
    if (token.length !== 8) {
      setError('Escribe el código completo de 8 dígitos.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setLoading(false);
    if (authError) setError(getAuthError(authError.message));
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-card bg-accent/15 flex items-center justify-center mb-4"><Music size={32} className="text-accent" /></div>
          <h1 className="text-3xl font-bold font-heading text-text-primary">{APP_CONFIG.name}</h1>
          <p className="text-text-secondary text-sm mt-1">{APP_CONFIG.tagline}</p>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-card p-6">
          {step === 'email' ? (
            <form onSubmit={(event) => void sendCode(event)} className="flex flex-col gap-4">
              <div className="text-center mb-2"><h2 className="text-lg font-semibold">Entra a tu cuenta</h2><p className="text-sm text-text-secondary mt-1">Te enviaremos un código de 8 dígitos a tu correo.</p></div>
              <Input type="email" name="email" label="Tu correo" placeholder="ejemplo@gmail.com" value={email} onChange={(event) => setEmail(event.target.value)} error={error} autoFocus autoComplete="email" />
              <Button type="submit" size="lg" fullWidth loading={loading}>Enviar código <ArrowRight size={18} /></Button>
              {APP_CONFIG.DEMO_ENABLED && onDemo && <Button type="button" variant="secondary" size="lg" fullWidth onClick={onDemo}>Probar modo demo</Button>}
            </form>
          ) : (
            <form onSubmit={(event) => void verifyCode(event)} className="flex flex-col gap-4">
              <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-2"><CheckCircle2 size={28} className="text-success" /></div>
              <div className="text-center"><h2 className="text-lg font-semibold">Revisa tu correo</h2><p className="text-sm text-text-secondary mt-1">Te enviamos un código de 8 dígitos a <span className="text-text-primary font-medium">{email}</span>.</p></div>
              <div className="flex justify-center gap-2">
                {code.map((digit, index) => <input key={index} ref={(element) => { codeRefs.current[index] = element; }} value={digit} onChange={(event) => updateCode(index, event.target.value)} onKeyDown={(event) => handleCodeKey(index, event)} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={1} aria-label={`Dígito ${index + 1}`} className="w-8 sm:w-10 h-12 text-center text-lg font-semibold bg-bg-elevated border border-border-subtle rounded-button text-text-primary focus:border-accent" />)}
              </div>
              {error && <div className="flex items-start gap-2 text-left bg-error/10 rounded-button p-3"><AlertCircle size={16} className="text-error flex-shrink-0 mt-0.5" /><p className="text-sm text-error">{error}</p></div>}
              <Button type="submit" size="lg" fullWidth loading={loading}>Entrar <ArrowRight size={18} /></Button>
              <div className="flex items-center justify-between text-sm"><button type="button" disabled={countdown > 0 || loading} onClick={() => void sendCode()} className="text-accent disabled:text-text-muted">{countdown > 0 ? `Reenviar código en ${countdown}s` : 'Reenviar código'}</button><button type="button" onClick={() => { setStep('email'); setError(null); }} className="text-text-muted hover:text-text-secondary">Cambiar correo</button></div>
            </form>
          )}
        </div>

        <div className="mt-6 flex items-start gap-2 text-xs text-text-muted"><ShieldCheck size={16} className="flex-shrink-0 mt-0.5" /><p>Solo pedimos tu correo para entrar y tu nombre para tu perfil. Nada más.</p></div>
      </div>
    </div>
  );
}
