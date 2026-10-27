import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History as HistoryIcon, Search } from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import Excerpt from '../components/Excerpt.jsx';
import { SectionLoader } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { chatService } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { formatDateTime, questionTerms } from '../utils/format.js';

export default function History() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      chatService.history({ search, documentId, page, limit: 15 }).then(setData).catch((e) => { toast.error(errorMessage(e)); setData((d) => d || { chats: [], documents: [], pages: 1, total: 0 }); });
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, documentId, page, toast]);

  const filtered = Boolean(search || documentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">History</h1>
        <p className="mt-1 text-sm text-muted">Every question you have asked, across all documents.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="input pl-9" placeholder="Search questions and answers" aria-label="Search history" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input sm:w-60" aria-label="Filter by document" value={documentId} onChange={(e) => { setDocumentId(e.target.value); setPage(1); }}>
          <option value="">All documents</option>
          {data?.documents.map((d) => <option key={d._id} value={d._id}>{d.originalName}</option>)}
        </select>
      </div>

      {!data ? <SectionLoader /> : data.chats.length === 0 ? (
        <div className="panel"><EmptyState icon={HistoryIcon} title={filtered ? 'Nothing matches' : 'No questions yet'}>{filtered ? 'Try different words or another document.' : 'Questions you ask about your documents will be listed here.'}</EmptyState></div>
      ) : (
        <ul className="space-y-3">
          {data.chats.map((c) => (
            <li key={c._id} className="panel">
              <details>
                <summary className="flex cursor-pointer flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between">
                  <span className="font-medium">{c.question}</span>
                  <span className="shrink-0 text-[13px] text-muted">{c.documentName}, {formatDateTime(c.createdAt)}</span>
                </summary>
                <div className="space-y-4 border-t border-rule px-5 py-4">
                  <p className={`whitespace-pre-wrap text-[14.5px] ${c.found ? '' : 'text-muted'}`}>{c.answer}</p>
                  {c.sources?.slice(0, 2).map((s, i) => <Excerpt key={i} page={s.page} clause={s.clause} text={s.text} terms={questionTerms(c.question)} />)}
                  {c.documentId && <Link to={`/app/chat/${c.documentId}`} className="inline-block text-sm text-seal hover:underline">Continue this conversation</Link>}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {data?.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{data.total} questions</span>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {page} of {data.pages}</span>
            <button className="btn-secondary btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
