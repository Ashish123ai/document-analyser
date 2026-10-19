import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { authService, userService } from '../services/index.js';
import { errorMessage, tokenStore } from '../services/api.js';
import PasswordField, { isStrongPassword } from '../components/PasswordField.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { ACTIVITY_LABEL, formatDateTime } from '../utils/format.js';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  const [activity, setActivity] = useState(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { userService.activity().then((r) => setActivity(r.activity)).catch(() => setActivity([])); }, []);

  async function saveName(e) {
    e.preventDefault();
    setSavingName(true);
    try {
      const { user: updated } = await userService.update(name.trim());
      setUser(updated);
      toast.success('Profile updated.');
    } catch (err) { toast.error(errorMessage(err)); } finally { setSavingName(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setSavingPw(true);
    try {
      const res = await authService.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      tokenStore.set(res); // the server signed out old sessions, so keep this one with the new tokens
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) { toast.error(errorMessage(err)); } finally { setSavingPw(false); }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await userService.deleteAccount(deletePw);
      tokenStore.clear();
      window.location.assign('/login');
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
    }
  }

  const mismatch = pw.confirm.length > 0 && pw.next !== pw.confirm;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl">Profile</h1>
        <p className="mt-1 text-sm text-muted">Manage your account and review recent activity.</p>
      </div>

      <section className="panel p-6">
        <h2 className="section-title mb-4">Account</h2>
        <form onSubmit={saveName} className="grid max-w-md gap-4">
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
          </div>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" className="input bg-paper" value={user.email} disabled />
            <p className="hint">Your email is your sign-in and cannot be changed here.</p>
          </div>
          <div><button className="btn-primary" disabled={savingName || name.trim().length < 2 || name.trim() === user.name}>{savingName && <Spinner />} Save changes</button></div>
        </form>
      </section>

      <section className="panel p-6">
        <h2 className="section-title mb-4">Change password</h2>
        <form onSubmit={changePassword} className="grid max-w-md gap-4">
          <PasswordField id="current" label="Current password" value={pw.current} onChange={(v) => setPw((p) => ({ ...p, current: v }))} />
          <PasswordField id="next" label="New password" value={pw.next} onChange={(v) => setPw((p) => ({ ...p, next: v }))} autoComplete="new-password" showRules />
          <PasswordField id="confirm" label="Confirm new password" value={pw.confirm} onChange={(v) => setPw((p) => ({ ...p, confirm: v }))} autoComplete="new-password" error={mismatch ? 'Passwords do not match' : ''} />
          <div><button className="btn-primary" disabled={savingPw || !pw.current || !isStrongPassword(pw.next) || pw.next !== pw.confirm}>{savingPw && <Spinner />} Change password</button></div>
        </form>
      </section>

      <section className="panel">
        <h2 className="section-title border-b border-rule px-6 py-4">Recent activity</h2>
        {activity === null ? <p className="p-6 text-sm text-muted">Loading</p> : activity.length === 0 ? <p className="p-6 text-sm text-muted">No activity recorded yet.</p> : (
          <ul className="divide-y divide-rule">
            {activity.map((a) => (
              <li key={a._id} className="flex flex-wrap items-baseline justify-between gap-2 px-6 py-3 text-sm">
                <span>{ACTIVITY_LABEL[a.action] || a.action}{a.meta?.name ? `: ${a.meta.name}` : ''}</span>
                <span className="text-[13px] text-muted">{formatDateTime(a.createdAt)}{a.ip ? `, ${a.ip.replace('::ffff:', '')}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-high/40 bg-white p-6">
        <h2 className="section-title text-high">Delete account</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">This permanently removes your account, every uploaded document, all analysis and chat history. It cannot be undone.</p>
        <button className="btn-danger mt-4" onClick={() => setShowDelete(true)}>Delete my account</button>
      </section>

      <ConfirmDialog open={showDelete} title="Delete your account?" confirmLabel="Delete everything" busy={deleting} confirmDisabled={!deletePw} onConfirm={deleteAccount} onCancel={() => { setShowDelete(false); setDeletePw(''); }}>
        <p>Enter your password to confirm.</p>
        <input type="password" className="input mt-3" aria-label="Password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}
