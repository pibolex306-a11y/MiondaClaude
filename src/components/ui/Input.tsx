import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
};

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  const inputId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full bg-bg-elevated border rounded-button px-4 py-3 text-text-primary',
          'placeholder:text-text-muted transition-colors duration-150',
          'focus:border-accent focus:ring-1 focus:ring-accent',
          'min-h-[48px]',
          error ? 'border-error' : 'border-border-subtle',
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : hint ? (
        <p className="text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
  maxChars?: number;
};

export function Textarea({ label, hint, error, maxChars, className, id, value, ...props }: TextareaProps) {
  const inputId = id || props.name;
  const len = typeof value === 'string' ? value.length : 0;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        value={value}
        className={cn(
          'w-full bg-bg-elevated border rounded-button px-4 py-3 text-text-primary',
          'placeholder:text-text-muted transition-colors duration-150 resize-none',
          'focus:border-accent focus:ring-1 focus:ring-accent',
          'min-h-[80px]',
          error ? 'border-error' : 'border-border-subtle',
          className,
        )}
        {...props}
      />
      <div className="flex justify-between">
        {error ? (
          <p className="text-sm text-error">{error}</p>
        ) : hint ? (
          <p className="text-sm text-text-muted">{hint}</p>
        ) : <span />}
        {maxChars && (
          <p className="text-sm text-text-muted tabular-nums">{len}/{maxChars}</p>
        )}
      </div>
    </div>
  );
}
