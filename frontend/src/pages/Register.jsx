import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import AuthShell, { AuthLink } from '../components/AuthShell.jsx';
import PasswordField, { isStrongPassword } from '../components/PasswordField.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const mismatch = form.confirm.length > 0 && form.password !== form.confirm;
  const valid = form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && isStrongPassword(form.password) && form.password === form.confirm;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Documents you upload are private to you."
      footer={<>Already registered? <AuthLink to="/login">Sign in</AuthLink></>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-high-tint p-3 text-sm text-high" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
          </div>
        )}
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" required autoFocus />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" className="input" value={form.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" required />
        </div>
        <PasswordField id="password" label="Password" value={form.password} onChange={set('password')} autoComplete="new-password" showRules />
        <PasswordField id="confirm" label="Confirm password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" error={mismatch ? 'Passwords do not match' : ''} />
        <button className="btn-primary w-full" disabled={busy || !valid}>{busy && <Spinner />} Create account</button>
      </form>
    </AuthShell>
  );
}
