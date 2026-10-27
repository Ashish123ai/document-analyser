import { Link } from 'react-router-dom';
import { FileText, MessageSquare, RotateCw, Trash2 } from 'lucide-react';
import StatusPill from './StatusPill.jsx';
import RiskBadge from './RiskBadge.jsx';
import { formatBytes, formatDate } from '../utils/format.js';

export default function DocumentRow({ doc, onDelete, onRetry }) {
  const ready = doc.status === 'ready';
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded bg-paper text-ink-soft" aria-hidden>
          <FileText className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <Link to={`/app/documents/${doc._id}`} className="block truncate font-medium hover:text-seal hover:underline">{doc.originalName}</Link>
          <p className="text-[13px] text-muted">
            {doc.fileType.toUpperCase()}, {formatBytes(doc.size)}
            {ready && doc.pageCount ? `, ${doc.pageCount} page${doc.pageCount > 1 ? 's' : ''}` : ''}, uploaded {formatDate(doc.createdAt)}
          </p>
          {doc.status === 'failed' && doc.errorMessage && <p className="mt-1 text-[13px] text-high">{doc.errorMessage}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <StatusPill status={doc.status} />
        {doc.analysis?.riskLevel ? <RiskBadge level={doc.analysis.riskLevel} /> : ready && <span className="text-xs text-muted">Not analyzed</span>}
        <div className="flex items-center gap-1">
          {ready && (
            <Link to={`/app/chat/${doc._id}`} className="btn-secondary btn-sm"><MessageSquare className="h-3.5 w-3.5" aria-hidden /> Ask</Link>
          )}
          {doc.status === 'failed' && (
            <button onClick={() => onRetry(doc)} className="btn-secondary btn-sm"><RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry processing</button>
          )}
          <button onClick={() => onDelete(doc)} className="btn-ghost btn-sm" aria-label={`Delete ${doc.originalName}`}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </li>
  );
}
