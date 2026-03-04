import { FormEvent, useState } from 'react';
import { useAppStore } from '../store';

interface LoginGateProps {
  detail: string | null;
}

export function LoginGate({ detail }: LoginGateProps) {
  const authenticate = useAppStore((state) => state.authenticate);
  const [email, setEmail] = useState('investigator@local.test');
  const [password, setPassword] = useState('change-me-demo-password');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authenticate(email, password);
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Sign In</h2>
      <p className="mt-1 text-sm text-slate-600">Authenticate to access the investigation workspace.</p>
      {detail ? (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{detail}</div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      ) : null}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="login-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800"
            placeholder="name@company.com"
            required
          />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800"
            placeholder="Enter password"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-teal-700 px-3 py-2 text-sm font-semibold text-white enabled:hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </section>
  );
}
