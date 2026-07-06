'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand } from '@komuta/config';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button, Card, Field, Input, cn } from '@/components/ui';
import { IconAlert } from '@/components/icons';

export default function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setError(t.auth.invalidCredentials);
      } else if (err instanceof ApiError && err.status === 403) {
        setError(t.auth.accountLocked);
      } else {
        setError(t.errors.validation);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f1b3d] px-4">
      {/* Decorative gradient blobs + subtle vertical wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand/20 via-transparent to-brand-accent/10" />
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-brand/40 blur-3xl" />

      <div className="absolute right-5 top-5 flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5 text-xs font-semibold backdrop-blur">
        {(['tr', 'en'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={cn(
              'rounded-md px-2.5 py-1 uppercase transition-colors',
              locale === l ? 'bg-white text-brand' : 'text-white/70 hover:text-white',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-accent text-2xl font-bold text-white shadow-lg">
            K
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{brand.name}</h1>
          <p className="mt-1 text-sm text-slate-300">{brand.tagline}</p>
        </div>

        <Card className="p-6 sm:p-7">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t.auth.email} htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="ozer@komuta.com"
                aria-invalid={!!error}
                className={cn(error && 'border-red-300 focus:border-red-400 focus:ring-red-100')}
              />
            </Field>

            <Field label={t.auth.password} htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                aria-invalid={!!error}
                className={cn(error && 'border-red-300 focus:border-red-400 focus:ring-red-100')}
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600 ring-1 ring-red-600/10"
              >
                <IconAlert width={16} height={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={submitting}>
              {t.auth.login}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          {brand.name} · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
