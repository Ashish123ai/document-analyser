import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { documentService } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { SectionLoader, Spinner } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Compare() {
  const toast = useToast();
  const [documents, setDocuments] = useState(null);
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    documentService.list({ status: 'ready', limit: 50 })
      .then((response) => setDocuments(response.documents))
      .catch((error) => {
        toast.error(errorMessage(error));
        setDocuments([]);
      });
  }, [toast]);

  async function compare() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await documentService.compare(beforeId, afterId));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!documents) return <SectionLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Compare documents</h1>
        <p className="mt-1 text-sm text-muted">Compare extracted text and risk findings for two documents you own.</p>
      </div>
      {documents.length < 2 ? (
        <section className="panel p-6 text-sm text-muted">
          Upload and process at least two documents before comparing them. <Link className="text-seal underline" to="/app/analyze">Go to documents</Link>
        </section>
      ) : (
        <section className="panel grid gap-4 p-5 sm:grid-cols-2">
          <label className="label">Earlier / baseline document
            <select className="input mt-1" value={beforeId} onChange={(event) => setBeforeId(event.target.value)}>
              <option value="">Select a document</option>
              {documents.map((doc) => <option key={doc._id} value={doc._id}>{doc.originalName}</option>)}
            </select>
          </label>
          <label className="label">Later / revised document
            <select className="input mt-1" value={afterId} onChange={(event) => setAfterId(event.target.value)}>
              <option value="">Select a document</option>
              {documents.map((doc) => <option key={doc._id} value={doc._id}>{doc.originalName}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button className="btn-primary" disabled={!beforeId || !afterId || beforeId === afterId || busy} onClick={compare}>
              {busy && <Spinner />} {busy ? 'Comparing' : 'Compare'}
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="space-y-4">
          <div className="panel p-5">
            <h2 className="section-title">Risk finding changes</h2>
            <p className="mt-2 text-sm">Overall rating: <b>{result.risk_change.before}</b> → <b>{result.risk_change.after}</b></p>
            <h3 className="mt-3 text-sm font-semibold text-high">New risk findings</h3>
            {result.risk_change.added_findings.length ? (
              <ul className="mt-1 space-y-1">{result.risk_change.added_findings.map((finding) => <li key={finding.category} className="text-sm"><b>{finding.title}</b>: {finding.explanation}</li>)}</ul>
            ) : <p className="text-sm text-muted">None identified</p>}
            <h3 className="mt-3 text-sm font-semibold text-low">No longer flagged</h3>
            {result.risk_change.removed_findings.length ? (
              <ul className="mt-1 space-y-1">{result.risk_change.removed_findings.map((finding) => <li key={finding.category} className="text-sm"><b>{finding.title}</b>: {finding.explanation}</li>)}</ul>
            ) : <p className="text-sm text-muted">None identified</p>}
            <p className="mt-3 text-xs text-muted">These are automated pattern/model findings and may include false positives or miss important changes.</p>
          </div>
          <div className="panel p-5">
            <h2 className="section-title">Text changes</h2>
            {result.truncated && <p className="mt-2 text-sm text-med">Showing the first 100 change groups.</p>}
            {result.changes.length === 0 ? <p className="mt-3 text-sm text-muted">No text changes detected.</p> : (
              <ol className="mt-3 space-y-3">
                {result.changes.map((change, index) => (
                  <li key={`${change.type}-${index}`} className="grid gap-3 rounded-md border border-rule p-3 md:grid-cols-2">
                    {change.type !== 'insert' && <div><p className="mb-1 text-xs font-semibold text-high">Removed / before</p><p className="whitespace-pre-wrap text-sm">{change.old_text}</p></div>}
                    {change.type !== 'delete' && <div><p className="mb-1 text-xs font-semibold text-low">Added / after</p><p className="whitespace-pre-wrap text-sm">{change.new_text}</p></div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}
      <p className="text-xs text-muted">Comparison is based on extracted text. It is not a legal opinion; review the source documents before relying on a change.</p>
    </div>
  );
}
