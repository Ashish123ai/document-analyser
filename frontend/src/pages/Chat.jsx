import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, MessageSquare, Send, Trash2 } from 'lucide-react';
import Excerpt from '../components/Excerpt.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SectionLoader, Spinner } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { chatService, documentService } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { questionTerms } from '../utils/format.js';

const SUGGESTIONS = [
  'What is the notice period for termination?',
  'What are the payment terms?',
  'What happens if I breach the agreement?',
  'Does this renew automatically?',
];

// Turns "[2]" in an answer into a link to the matching source below it.
function AnswerText({ text, chatKey }) {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    return m ? (
      <a key={i} href={`#src-${chatKey}-${m[1]}`} className="mx-0.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded bg-mark px-1 align-super text-[11px] font-semibold text-ink no-underline" aria-label={`Source ${m[1]}`}>{m[1]}</a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
  });
}

function Exchange({ chat, pending }) {
  const key = chat._id || 'pending';
  const terms = questionTerms(chat.question);
  return (
    <div className="space-y-3">
      <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-lg bg-ink px-4 py-2.5 text-sm text-white">{chat.question}</p>
      {pending ? (
        <p className="flex items-center gap-2 text-sm text-muted" role="status"><Spinner /> Searching the document</p>
      ) : (
        <div className="max-w-[95%]">
          <div className={`rounded-lg border px-4 py-3 text-[14.5px] leading-relaxed ${chat.found ? 'border-rule bg-white' : 'border-dashed border-rule bg-paper text-muted'}`}>
            <p className="whitespace-pre-wrap"><AnswerText text={chat.answer} chatKey={key} /></p>
          </div>
          {chat.sources?.length > 0 && (
            <details className="mt-2 pl-1" open={chat.sources.length <= 2}>
              <summary className="cursor-pointer text-[13px] font-medium text-seal hover:underline">From the document ({chat.sources.length})</summary>
              <div className="mt-3 space-y-4">
                {chat.sources.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="mt-1 grid h-[18px] w-[18px] shrink-0 place-items-center rounded bg-mark text-[11px] font-semibold">{i + 1}</span>
                    <Excerpt id={`src-${key}-${i + 1}`} page={s.page} clause={s.clause} text={s.text} terms={terms} className="min-w-0 flex-1 scroll-mt-24" />
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [docs, setDocs] = useState(null);
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    documentService.list({ status: 'ready', limit: 50 }).then((r) => setDocs(r.documents)).catch((e) => { toast.error(errorMessage(e)); setDocs([]); });
  }, [toast]);

  const current = docs?.find((d) => d._id === documentId);

  useEffect(() => {
    if (!documentId) return;
    setLoadingChats(true);
    setChats([]);
    chatService.list(documentId).then((r) => setChats(r.chats)).catch((e) => toast.error(errorMessage(e))).finally(() => setLoadingChats(false));
  }, [documentId, toast]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chats, pending]);

  const send = useCallback(async (text) => {
    const q = text.trim();
    if (q.length < 3 || pending) return;
    setQuestion('');
    setPending(q);
    try {
      const { chat } = await chatService.ask(documentId, q);
      setChats((c) => [...c, chat]);
    } catch (err) {
      toast.error(errorMessage(err));
      setQuestion(q);
    } finally {
      setPending(null);
    }
  }, [documentId, pending, toast]);

  async function clear() {
    try {
      await chatService.clear(documentId);
      setChats([]);
      toast.success('Conversation cleared.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setConfirmClear(false);
  }

  if (docs === null) return <SectionLoader />;

  if (docs.length === 0) {
    return (
      <div className="panel">
        <EmptyState icon={MessageSquare} title="No documents ready" action={<Link to="/documents" className="btn-primary">Upload a document</Link>}>
          Upload a contract and wait for it to finish processing, then come back to ask questions.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside aria-label="Choose a document">
        <h1 className="mb-3 text-lg">Ask a question</h1>
        <label htmlFor="doc-select" className="label lg:hidden">Document</label>
        <select id="doc-select" className="input lg:hidden" value={documentId || ''} onChange={(e) => navigate(`/chat/${e.target.value}`)}>
          <option value="" disabled>Choose a document</option>
          {docs.map((d) => <option key={d._id} value={d._id}>{d.originalName}</option>)}
        </select>
        <ul className="hidden max-h-[70vh] space-y-1 overflow-y-auto lg:block">
          {docs.map((d) => (
            <li key={d._id}>
              <Link to={`/chat/${d._id}`} aria-current={d._id === documentId ? 'page' : undefined}
                className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${d._id === documentId ? 'bg-seal-tint font-medium text-seal' : 'text-ink-soft hover:bg-white'}`}>
                <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span className="break-words">{d.originalName}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="panel flex min-h-[32rem] flex-col lg:h-[calc(100vh-4.5rem)]" aria-label="Conversation">
        {!documentId ? (
          <EmptyState icon={MessageSquare} title="Choose a document">Pick one from the list to start asking questions about it.</EmptyState>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
              <p className="min-w-0 truncate text-sm"><span className="text-muted">Asking about</span> <b>{current?.originalName || 'this document'}</b></p>
              {chats.length > 0 && <button className="btn-ghost btn-sm" onClick={() => setConfirmClear(true)}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear</button>}
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5" aria-live="polite">
              {loadingChats ? <SectionLoader /> : chats.length === 0 && !pending ? (
                <div className="mx-auto max-w-md pt-6 text-center">
                  <p className="font-medium">Ask anything about this document</p>
                  <p className="hint">Answers are quoted from the document and show the page they came from.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-rule bg-white px-3 py-1.5 text-[13px] hover:border-seal hover:text-seal">{s}</button>)}
                  </div>
                </div>
              ) : (
                <>
                  {chats.map((c) => <Exchange key={c._id} chat={c} />)}
                  {pending && <Exchange chat={{ question: pending }} pending />}
                </>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(question); }} className="border-t border-rule p-4">
              <div className="flex items-end gap-2">
                <label htmlFor="question" className="sr-only">Your question</label>
                <textarea id="question" rows={2} maxLength={1000} className="input resize-none" placeholder="Ask about this document" value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(question); } }} />
                <button className="btn-primary h-10" disabled={Boolean(pending) || question.trim().length < 3} aria-label="Send question"><Send className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 text-xs text-muted">Answers come only from this document. They are not legal advice.</p>
            </form>
          </>
        )}
      </section>

      <ConfirmDialog open={confirmClear} title="Clear this conversation?" confirmLabel="Clear" onConfirm={clear} onCancel={() => setConfirmClear(false)}>
        All questions and answers for this document will be removed.
      </ConfirmDialog>
    </div>
  );
}
