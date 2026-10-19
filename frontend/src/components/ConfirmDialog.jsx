import { useEffect, useRef } from 'react';
import { Spinner } from './Spinner.jsx';

// Uses the native <dialog>, which gives focus trapping and Esc-to-close for free.
export default function ConfirmDialog({ open, title, children, confirmLabel = 'Delete', busy = false, confirmDisabled = false, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => e.target === ref.current && onCancel()}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-rule bg-white p-0 text-ink backdrop:bg-ink/50"
    >
      <div className="p-6">
        <h2 className="text-lg">{title}</h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-rule bg-paper px-6 py-3">
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm} disabled={busy || confirmDisabled}>
          {busy && <Spinner />} {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
