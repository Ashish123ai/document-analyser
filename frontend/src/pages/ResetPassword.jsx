import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AuthShell, { AuthLink } from '../components/AuthShell.jsx';
import PasswordField, { isStrongPassword } from '../components/PasswordField.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { authService } from '../services/index.js';
import { errorMessage, tokenStore } from '../services/api.js';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authService.resetPassword(token, password);
      tokenStore.clear(); // every old session was signed out by the server
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
      window.location.reload();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You will be signed out of all other devices." footer={<AuthLink to="/login">Back to sign in</AuthLink>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <p className="rounded-md bg-high-tint p-3 text-sm text-high" role="alert">{error}</p>}
        <PasswordField id="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" showRules />
        <PasswordField id="confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={mismatch ? 'Passwords do not match' : ''} />
        <button className="btn-primary w-full" disabled={busy || !isStrongPassword(password) || password !== confirm}>{busy && <Spinner />} Update password</button>
      </form>
    </AuthShell>
  );
}
