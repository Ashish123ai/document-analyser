import { useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';

export const passwordChecks = (pw) => [
  { ok: pw.length >= 8, label: 'At least 8 characters' },
  { ok: /[a-z]/.test(pw), label: 'A lowercase letter' },
  { ok: /[A-Z]/.test(pw), label: 'An uppercase letter' },
  { ok: /\d/.test(pw), label: 'A number' },
];
export const isStrongPassword = (pw) => passwordChecks(pw).every((c) => c.ok);

export default function PasswordField({ id, label = 'Password', value, onChange, autoComplete = 'current-password', showRules = false, error }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`input pr-10 ${error ? 'input-error' : ''}`}
          aria-invalid={Boolean(error)}
          required
        />
        <button type="button" onClick={() => setVisible((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink" aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {showRules && value.length > 0 && (
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]" aria-label="Password requirements">
          {passwordChecks(value).map((c) => (
            <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'text-low' : 'text-muted'}`}>
              {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
