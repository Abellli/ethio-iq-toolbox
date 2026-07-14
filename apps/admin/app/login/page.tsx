'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-8 shadow-card"
      >
        <h1 className="mb-1 text-lg font-medium text-text">Ethio IQ Toolbox</h1>
        <p className="mb-6 text-sm text-text-muted">Sign in to your client dashboard</p>

        <label className="mb-1 block text-sm text-text-muted">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <label className="mb-1 block text-sm text-text-muted">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-card border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {error && <p className="mb-4 text-sm text-chart-coral">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-card bg-primary py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
