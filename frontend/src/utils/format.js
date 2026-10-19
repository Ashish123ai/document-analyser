export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(d) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, secs] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

export const RISK_LABEL = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' };

export const ACTIVITY_LABEL = {
  'auth.register': 'Created your account',
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in attempt',
  'auth.logout': 'Signed out',
  'auth.account_locked': 'Account locked after repeated failures',
  'auth.password_changed': 'Changed password',
  'auth.password_reset': 'Reset password',
  'auth.password_reset_requested': 'Requested a password reset',
  'document.upload': 'Uploaded a document',
  'document.delete': 'Deleted a document',
  'document.download': 'Downloaded a document',
  'document.analyze': 'Analyzed a document',
  'chat.ask': 'Asked a question',
  'user.profile_updated': 'Updated profile',
};

// Wraps words from `terms` in <mark> so cited passages show why they matched.
export function highlightParts(text, terms) {
  const words = [...new Set(terms.map((t) => t.toLowerCase()).filter((t) => t.length > 3))];
  if (!words.length) return [{ text, hit: false }];
  const rx = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(rx).filter(Boolean).map((part) => ({ text: part, hit: words.includes(part.toLowerCase()) }));
}

export const STOP = new Set(['what', 'when', 'where', 'which', 'does', 'this', 'that', 'with', 'from', 'have', 'there', 'about', 'tell', 'will', 'shall', 'document', 'agreement']);
export const questionTerms = (q) => (q.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !STOP.has(w));
