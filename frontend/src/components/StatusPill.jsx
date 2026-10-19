import { CheckCircle2, XCircle } from 'lucide-react';
import { Spinner } from './Spinner.jsx';

export default function StatusPill({ status }) {
  if (status === 'processing')
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-seal"><Spinner className="h-3.5 w-3.5" /> Processing</span>;
  if (status === 'failed')
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-high"><XCircle className="h-3.5 w-3.5" aria-hidden /> Failed</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-low"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready</span>;
}
