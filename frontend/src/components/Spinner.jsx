import { Loader2 } from 'lucide-react';

export const Spinner = ({ className = 'h-4 w-4' }) => <Loader2 className={`animate-spin ${className}`} aria-hidden />;

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center" role="status">
      <Spinner className="h-6 w-6 text-seal" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SectionLoader({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status">
      <Spinner /> {label}
    </div>
  );
}
