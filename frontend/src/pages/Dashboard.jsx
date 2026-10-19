import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardService } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { SectionLoader } from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import RiskBadge from '../components/RiskBadge.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { timeAgo } from '../utils/format.js';

function Figure({ value, label, note }) {
  return (
    <div className="panel metric-card px-5 py-5 sm:px-6">
      <p className="text-3xl font-semibold tabular-nums text-seal">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
      {note && <p className="mt-1 text-[13px] text-muted">{note}</p>}
    </div>
  );
}

function RiskBar({ counts }) {
  const total = counts.high + counts.medium + counts.low;
  if (!total) return <p className="text-sm text-muted">No risks flagged yet. Analyze a document to see them here.</p>;
  const seg = [
    ['high', 'High', 'bg-high'],
    ['medium', 'Medium', 'bg-[#E3A21A]'],
    ['low', 'Low', 'bg-low'],
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-paper" role="img" aria-label={`${counts.high} high, ${counts.medium} medium, ${counts.low} low risks`}>
        {seg.map(([k, , cls]) => counts[k] > 0 && <div key={k} className={cls} style={{ width: `${(counts[k] / total) * 100}%` }} />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {seg.map(([k, label, cls]) => (
          <li key={k} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${cls}`} aria-hidden /> {label}: <b className="tabular-nums">{counts[k]}</b></li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardService.stats().then(setData).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="rounded-md bg-high-tint p-4 text-sm text-high" role="alert">{error}</p>;
  if (!data) return <SectionLoader />;

  const { stats, recentDocuments, recentQuestions } = data;
  const first = user.name.split(' ')[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Welcome back, {first}</h1>
          <p className="mt-1 text-sm text-muted">Here is where your documents stand.</p>
        </div>
        <Link to="/documents" className="btn-primary">Upload a document</Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary figures">
        <Figure value={stats.documents} label="Documents" note={`${stats.ready} ready`} />
        <Figure value={stats.analyzed} label="Analyzed" />
        <Figure value={stats.questions} label="Questions asked" />
        <Figure value={stats.risksFound} label="Risks flagged" note={`${stats.risksByLevel.high} high`} />
      </section>

      <section className="panel p-6">
        <h2 className="section-title mb-4">Risks across your documents</h2>
        <RiskBar counts={stats.risksByLevel} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3">
            <h2 className="section-title">Recent documents</h2>
            <Link to="/documents" className="text-sm text-seal hover:underline">View all</Link>
          </div>
          {recentDocuments.length === 0 ? (
            <EmptyState icon={FileText} title="No documents yet" action={<Link to="/documents" className="btn-primary btn-sm">Upload your first contract</Link>}>
              Upload a PDF, DOCX or TXT file to get a summary, risk review and answers to your questions.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-rule">
              {recentDocuments.map((d) => (
                <li key={d._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link to={`/documents/${d._id}`} className="block truncate font-medium hover:text-seal hover:underline">{d.originalName}</Link>
                    <p className="text-[13px] text-muted">{timeAgo(d.createdAt)}</p>
                  </div>
                  {d.analysis?.riskLevel ? <RiskBadge level={d.analysis.riskLevel} /> : <StatusPill status={d.status} />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="flex items-center justify-between border-b border-rule px-5 py-3">
            <h2 className="section-title">Recent questions</h2>
            <Link to="/history" className="text-sm text-seal hover:underline">View history</Link>
          </div>
          {recentQuestions.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No questions yet">
              Open a ready document and ask something like "What is the notice period?"
            </EmptyState>
          ) : (
            <ul className="divide-y divide-rule">
              {recentQuestions.map((q) => (
                <li key={q.id} className="px-5 py-3">
                  <Link to={q.documentId ? `/chat/${q.documentId}` : '/history'} className="block truncate font-medium hover:text-seal hover:underline">{q.question}</Link>
                  <p className="truncate text-[13px] text-muted">{q.documentName}, {timeAgo(q.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
