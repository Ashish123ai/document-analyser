import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import UploadZone from '../components/UploadZone.jsx';
import DocumentRow from '../components/DocumentRow.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SectionLoader } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { documentService } from '../services/index.js';
import { errorMessage } from '../services/api.js';

export default function Documents() {
  const toast = useToast();
  const [docs, setDocs] = useState(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const timer = useRef(null);

  const load = useCallback(
    async (opts = {}) => {
      try {
        const res = await documentService.list({ search: opts.search ?? search, status: opts.status ?? status, page: opts.page ?? page, limit: 10 });
        setDocs(res.documents);
        setTotal(res.total);
        setPages(res.pages);
      } catch (err) {
        toast.error(errorMessage(err));
        setDocs((d) => d || []);
      }
    },
    [search, status, page, toast]
  );

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, search ? 300 : 0); // debounce typing in the search box
    return () => clearTimeout(timer.current);
  }, [load, search]);

  // Poll while anything is still being processed.
  const hasProcessing = docs?.some((d) => d.status === 'processing');
  useEffect(() => {
    if (!hasProcessing) return undefined;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [hasProcessing, load]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await documentService.remove(toDelete._id);
      toast.success(`${toDelete.originalName} deleted.`);
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function retry(doc) {
    try {
      await documentService.reprocess(doc._id);
      toast.success('Processing restarted.');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const filtered = Boolean(search || status);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl">Documents</h1>
            <p className="mt-1 text-sm text-muted">Only you can see the documents you upload.</p>
          </div>
          <Link to="/app/compare" className="btn-secondary">Compare documents</Link>
        </div>
      </div>

      <div id="upload">
        <UploadZone compact={Boolean(docs?.length)} onUploaded={() => { setPage(1); load({ page: 1 }); }} />
      </div>

      <section className="panel">
        <div className="flex flex-col gap-3 border-b border-rule p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input className="input pl-9" placeholder="Search by file name" aria-label="Search documents" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input sm:w-44" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {docs === null ? (
          <SectionLoader />
        ) : docs.length === 0 ? (
          <EmptyState icon={FileText} title={filtered ? 'No documents match' : 'No documents yet'}>
            {filtered ? 'Try a different search or clear the status filter.' : 'Drop a contract above to get started.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule">
            {docs.map((d) => <DocumentRow key={d._id} doc={d} onDelete={setToDelete} onRetry={retry} />)}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-rule px-5 py-3 text-sm">
            <span className="text-muted">{total} documents</span>
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {pages}</span>
              <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog open={Boolean(toDelete)} title="Delete this document?" confirmLabel="Delete document" busy={deleting} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
        <b className="text-ink">{toDelete?.originalName}</b> and its analysis and chat history will be permanently removed. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
