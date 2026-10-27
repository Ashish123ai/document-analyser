import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileDown, MessageSquare, ScanSearch, Trash2 } from 'lucide-react';
import RiskBadge from '../components/RiskBadge.jsx';
import StatusPill from '../components/StatusPill.jsx';
import Excerpt from '../components/Excerpt.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { SectionLoader, Spinner } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { documentService } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { formatBytes, formatDate } from '../utils/format.js';

const TABS = [['summary', 'Summary'], ['risks', 'Risks'], ['clauses', 'Clauses']];

function List({ title, items }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items?.length ? (
        <ul className="list-disc space-y-1.5 pl-5 text-[14.5px] marker:text-muted">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
      ) : (
        <p className="text-sm text-muted">Not identified in this document.</p>
      )}
    </section>
  );
}

function RiskScore({ analysis }) {
  if (!Number.isFinite(analysis.riskScore)) return null;
  return (
    <section className="panel flex flex-wrap items-center gap-5 p-5">
      <div
        className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
        role="img"
        aria-label={`Risk score ${analysis.riskScore} out of 100`}
        style={{ background: `conic-gradient(rgb(var(--high)) ${analysis.riskScore * 3.6}deg, rgb(var(--rule)) 0deg)` }}
      >
        <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-white text-center">
          <span><b className="block text-2xl leading-7">{analysis.riskScore}</b><small className="text-muted">/100</small></span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="section-title">Indicative risk score</h2>
        <p className="mt-1 text-sm text-muted">{analysis.riskScoreBreakdown?.formula}</p>
        <p className="mt-1 text-xs text-muted">A project-specific screening indicator, not a legal opinion or probability of loss.</p>
      </div>
    </section>
  );
}

function SummaryTab({ summary }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="section-title mb-2">In brief</h2>
        <p className="max-w-prose font-serif text-[17px] leading-[1.75] text-ink-soft">{summary.executive_summary}</p>
      </section>
      <dl className="grid gap-x-8 gap-y-4 border-y border-rule py-5 sm:grid-cols-3">
        <div><dt className="text-sm text-muted">Document type</dt><dd className="font-medium">{summary.document_type || summary.contract_type}</dd></div>
        <div><dt className="text-sm text-muted">Duration</dt><dd className="font-medium">{summary.duration}</dd></div>
        <div><dt className="text-sm text-muted">Parties</dt><dd className="font-medium">{summary.parties?.length ? summary.parties.join(' and ') : 'Not identified'}</dd></div>
      </dl>
      <div className="grid gap-8 md:grid-cols-2">
        <List title="Payment terms" items={summary.payment_terms} />
        <List title="Termination conditions" items={summary.termination_conditions} />
        <List title="Responsibilities" items={summary.responsibilities} />
        <List title="Penalties" items={summary.penalties} />
        <List title="Important dates" items={summary.important_dates} />
      </div>
      {summary.checklist?.length > 0 && (
        <section>
          <h2 className="section-title mb-2">Suggested checklist for this document type</h2>
          <p className="mb-3 text-xs text-muted">A checklist prompt, not a conclusion that every item is legally required.</p>
          <ul className="flex flex-wrap gap-2">{summary.checklist.map((item) => <li key={item} className="rounded-full border border-rule px-3 py-1 text-sm">{item}</li>)}</ul>
        </section>
      )}
      {summary.entities?.amounts?.length > 0 && <List title="Amounts found in document" items={summary.entities.amounts} />}
      {summary.obligations?.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Obligations and deadlines</h2>
          <ul className="space-y-3">
            {summary.obligations.map((item, index) => (
              <li key={`${item.page}-${index}`} className="rounded-md border border-rule p-3">
                <p className="text-sm">{item.text}</p>
                <p className="mt-1 text-xs text-muted">{item.party} · Page {item.page} · Deadline: {item.deadline}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RisksTab({ analysis }) {
  const [filter, setFilter] = useState('all');
  const risks = analysis.risks || [];
  const count = (l) => risks.filter((r) => r.level === l).length;
  const shown = filter === 'all' ? risks : risks.filter((r) => r.level === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Overall</span>
        <RiskBadge level={analysis.riskLevel} />
        <div className="ml-auto flex gap-1" role="group" aria-label="Filter risks">
          {[['all', `All ${risks.length}`], ['high', `High ${count('high')}`], ['medium', `Medium ${count('medium')}`], ['low', `Low ${count('low')}`]].map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`btn-sm rounded-md border px-3 py-1 text-[13px] font-medium ${filter === k ? 'border-seal bg-seal-tint text-seal' : 'border-rule bg-white text-muted hover:text-ink'}`}>{label}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 && <p className="panel p-6 text-center text-sm text-muted">No risks in this category.</p>}

      <ul className="space-y-4">
        {shown.map((r, i) => (
          <li key={i} className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={r.level} compact />
              <h3 className="font-semibold">{r.title}</h3>
            </div>
            {r.clauseText && <Excerpt className="mt-4" page={r.page} text={r.clauseText} />}
            <p className="mt-2 text-xs text-muted">Evidence: {r.evidenceStrength === 'strong' ? 'Strong — rule matched and passage verified' : r.evidenceStrength === 'verified_quote' ? 'Passage verified in the document' : 'Needs manual verification'}</p>
            {r.explanation && <p className="mt-4 text-[14.5px]">{r.explanation}</p>}
            {r.recommendation && <p className="mt-2 text-[14.5px]"><b>What to do:</b> {r.recommendation}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClausesTab({ analysis }) {
  const clauses = analysis.clauses || [];
  return (
    <div className="space-y-6">
      {analysis.missingClauses?.length > 0 && (
        <div className="rounded-md border-l-4 border-[#E3A21A] bg-med-tint p-4 text-sm">
          <p className="font-semibold text-med">Not found in this document</p>
          <p className="mt-1">{analysis.missingClauses.join(', ')}. Missing clauses can leave gaps, so check whether they should be added.</p>
        </div>
      )}
      <ul className="space-y-4">
        {clauses.map((c) => (
          <li key={c.type} className="panel p-5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h3 className="font-semibold">{c.label}</h3>
              <span className="text-[13px] text-muted">Page {c.page}{c.clauseRef ? `, ${c.clauseRef}` : ''}</span>
            </div>
            <p className="mt-1.5 text-[14.5px]">{c.explanation}</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-seal hover:underline">Show the clause text</summary>
              <Excerpt className="mt-3" page={c.page} clause={c.clauseRef} text={c.excerpt} />
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('summary');
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => documentService.get(id).then((r) => setDoc(r.document)).catch((e) => setError(errorMessage(e))), [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (doc?.status !== 'processing') return undefined;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [doc?.status, load]);

  async function analyze() {
    setAnalyzing(true);
    try {
      const { document } = await documentService.analyze(id);
      setDoc(document);
      setTab('summary');
      toast.success('Analysis complete.');
    } catch (err) {
      toast.error(errorMessage(err));
      load();
    } finally {
      setAnalyzing(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await documentService.remove(id);
      toast.success('Document deleted.');
      navigate('/app/documents', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
    }
  }

  const run = (fn) => () => fn().catch((e) => toast.error(errorMessage(e)));

  if (error) return (
    <div className="panel p-8 text-center">
      <h1 className="text-xl">{error}</h1>
      <Link to="/app/documents" className="btn-primary mt-4">Back to documents</Link>
    </div>
  );
  if (!doc) return <SectionLoader />;

  const analysis = doc.analysis;
  const analyzed = doc.analysisStatus === 'done' && analysis?.summary;
  const running = analyzing || doc.analysisStatus === 'running';

  return (
    <div className="space-y-6">
      <Link to="/app/documents" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Documents</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl">{doc.originalName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <StatusPill status={doc.status} />
            <span>{doc.fileType.toUpperCase()}, {formatBytes(doc.size)}</span>
            {doc.status === 'ready' && <span>{doc.pageCount} page{doc.pageCount > 1 ? 's' : ''}, {doc.wordCount.toLocaleString()} words</span>}
            <span>Uploaded {formatDate(doc.createdAt)}</span>
          </p>
          {doc.status === 'failed' && <p className="mt-2 text-sm text-high">{doc.errorMessage}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.status === 'ready' && <Link to={`/app/chat/${doc._id}`} className="btn-primary"><MessageSquare className="h-4 w-4" aria-hidden /> Ask questions</Link>}
          <button className="btn-secondary" onClick={run(() => documentService.download(doc._id, doc.originalName))}><Download className="h-4 w-4" aria-hidden /> Original</button>
          {analyzed && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={run(() => documentService.report(doc._id, doc.originalName, 'md'))}><FileDown className="h-4 w-4" aria-hidden /> Markdown</button>
              <button className="btn-secondary" onClick={run(() => documentService.report(doc._id, doc.originalName, 'pdf'))}>PDF</button>
              <button className="btn-secondary" onClick={run(() => documentService.report(doc._id, doc.originalName, 'docx'))}>DOCX</button>
            </div>
          )}
          <button className="btn-ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete document"><Trash2 className="h-4 w-4" /></button>
        </div>
      </header>

      {doc.status === 'processing' && (
        <div className="panel flex items-center gap-3 p-6 text-sm" role="status"><Spinner className="h-5 w-5 text-seal" /> Reading the document and preparing it for questions. This usually takes under a minute.</div>
      )}

      {doc.status === 'ready' && !analyzed && (
        <section className="panel p-8 text-center">
          <ScanSearch className="mx-auto h-9 w-9 text-seal" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-3 text-lg">Analyze this document</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">You will get a plain-English summary, a list of risky clauses with suggestions, and a map of the standard clauses found or missing.</p>
          <button className="btn-primary mt-5" onClick={analyze} disabled={running}>{running && <Spinner />} {running ? 'Analyzing. This can take a minute' : 'Run analysis'}</button>
        </section>
      )}

      {analyzed && (
        <section>
          <div className="flex items-center justify-between border-b border-rule">
            <div role="tablist" aria-label="Analysis" className="flex gap-1">
              {TABS.map(([k, label]) => (
                <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => setTab(k)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${tab === k ? 'border-seal text-seal' : 'border-transparent text-muted hover:text-ink'}`}>
                  {label}{k === 'risks' ? ` (${analysis.risks.length})` : ''}
                </button>
              ))}
            </div>
            <button className="btn-ghost btn-sm" onClick={analyze} disabled={running}>{running && <Spinner />} Re-run analysis</button>
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
            {tab === 'summary' && <div className="space-y-6"><RiskScore analysis={analysis} /><SummaryTab summary={analysis.summary} /></div>}
            {tab === 'risks' && <RisksTab analysis={analysis} />}
            {tab === 'clauses' && <ClausesTab analysis={analysis} />}
          </div>
          <p className="mt-10 text-[13px] text-muted">AI-generated analysis for information only. It is not legal advice, so have a qualified lawyer review anything important.</p>
        </section>
      )}

      <ConfirmDialog open={confirmDelete} title="Delete this document?" confirmLabel="Delete document" busy={deleting} onConfirm={remove} onCancel={() => setConfirmDelete(false)}>
        The file, its analysis and its chat history will be permanently removed.
      </ConfirmDialog>
    </div>
  );
}
