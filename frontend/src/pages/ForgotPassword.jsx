import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import AuthShell, { AuthLink } from '../components/AuthShell.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { authService } from '../services/index.js';
import { errorMessage } from '../services/api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      setResult(await authService.forgotPassword(email.trim()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we will send you a reset link."
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md bg-low-tint p-3 text-sm text-low" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {result.message}
          </div>
          {result.devResetUrl && (
            <div className="rounded-md border border-dashed border-rule p-3 text-sm">
              <p className="font-medium">Development mode</p>
              <p className="hint">No email server is configured, so the link is shown here instead.</p>
              <a href={result.devResetUrl} className="mt-2 block break-all text-seal hover:underline">{result.devResetUrl}</a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <p className="rounded-md bg-high-tint p-3 text-sm text-high" role="alert">{error}</p>}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </div>
          <button className="btn-primary w-full" disabled={busy || !email}>{busy && <Spinner />} Send reset link</button>
        </form>
      )}
    </AuthShell>
  );
}
