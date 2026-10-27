import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, FileSearch, FileText, Menu, Moon, Scale, ShieldCheck, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { Logo } from '../components/Layout.jsx';

const FEATURES = [
  {
    icon: FileText,
    title: 'Understand the agreement',
    text: 'Get a plain-language summary of the terms, parties, dates, and obligations in a PDF, DOCX, or TXT file.',
  },
  {
    icon: ShieldCheck,
    title: 'Review potential risks',
    text: 'Surface clauses that may deserve attention, with evidence from the document and practical suggestions.',
  },
  {
    icon: FileSearch,
    title: 'Ask with source citations',
    text: 'Ask questions grounded in the uploaded document and trace answers back to relevant passages.',
  },
  {
    icon: Scale,
    title: 'Compare versions',
    text: 'Review text changes and risk-finding changes across two processed documents.',
  },
];

function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button type="button" className="btn-ghost btn-sm" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-5xl rounded-2xl border border-slate-700 bg-[#0d1522] p-2 shadow-2xl shadow-indigo-950/30 sm:p-4">
      <div className="flex items-center gap-1.5 border-b border-slate-700 px-3 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
        <span className="ml-3 text-[11px] font-mono text-slate-500">INSIGHTLENS / WORKSPACE PREVIEW</span>
      </div>
      <div className="grid gap-3 p-2 sm:grid-cols-[1fr_1.7fr] sm:p-4">
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">Document review</p>
            <div className="mt-3 h-2 w-3/4 rounded bg-slate-700" />
            <div className="mt-2 h-2 w-full rounded bg-slate-800" />
            <div className="mt-2 h-2 w-5/6 rounded bg-slate-800" />
            <div className="mt-5 flex gap-2">
              <span className="rounded-full border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200">Summary</span>
              <span className="rounded-full border border-indigo-400/30 px-2 py-1 text-[10px] text-indigo-200">Clauses</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Evidence & citations</p>
            <div className="mt-3 h-2 w-full rounded bg-slate-700" />
            <div className="mt-2 h-2 w-4/5 rounded bg-slate-800" />
            <div className="mt-2 h-2 w-2/3 rounded bg-slate-800" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">Analysis workspace</p>
              <div className="mt-2 h-3 w-44 max-w-full rounded bg-slate-700" />
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-200">Source-grounded review</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {['Executive summary', 'Risk findings', 'Clause review'].map((item) => (
              <div key={item} className="rounded-lg border border-slate-700 bg-[#111c2d] p-3">
                <p className="text-xs font-medium text-slate-200">{item}</p>
                <div className="mt-3 h-1.5 w-full rounded bg-slate-700" />
                <div className="mt-2 h-1.5 w-4/5 rounded bg-slate-800" />
                <div className="mt-2 h-1.5 w-2/3 rounded bg-slate-800" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-right font-mono text-[10px] text-slate-500">Illustrative interface preview</p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const appPath = user ? '/app/dashboard' : '/register';
  return (
    <div className="min-h-screen overflow-hidden bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-700/70 bg-[#101827]/95 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="InsightLens home"><Logo light /></Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Landing page">
            <a href="#features" className="whitespace-nowrap text-sm text-slate-300 hover:text-white">Features</a>
            <a href="#how-it-works" className="whitespace-nowrap text-sm text-slate-300 hover:text-white">How it works</a>
            <a href="#preview" className="whitespace-nowrap text-sm text-slate-300 hover:text-white">Preview</a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeButton />
            {!user && <Link to="/login" className="hidden whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10 sm:inline-flex">Sign in</Link>}
            <Link to={appPath} className="btn-primary btn-sm whitespace-nowrap !bg-cyan-300 !text-slate-950 hover:!bg-cyan-200">
              {user ? 'Open workspace' : 'Get started'} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              className="btn-ghost p-2 text-slate-100 hover:text-white md:hidden"
              aria-label={mobileMenuOpen ? 'Close landing page menu' : 'Open landing page menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav id="landing-mobile-navigation" className="border-t border-slate-700 px-4 py-3 md:hidden" aria-label="Mobile landing page">
            <div className="mx-auto grid max-w-7xl gap-1">
              {[
                ['#features', 'Features'],
                ['#how-it-works', 'How it works'],
                ['#preview', 'Preview'],
                ...(!user ? [['/login', 'Sign in']] : []),
              ].map(([to, label]) => (
                <a
                  key={to}
                  href={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#101827] px-4 pb-20 pt-16 text-white sm:px-6 sm:pb-28 sm:pt-24">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_5%,rgba(34,211,238,0.16),transparent_38%),radial-gradient(ellipse_at_15%_90%,rgba(99,102,241,0.18),transparent_38%)]" />
          <div className="mx-auto max-w-5xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Legal risk review, made clearer
            </p>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
              See what matters in your contract.
              <span className="block bg-gradient-to-r from-cyan-200 to-indigo-300 bg-clip-text text-transparent">Understand it with confidence.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Get a clear summary, review potential risks, and ask questions grounded in the document—not guesswork.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to={appPath} className="btn-primary !bg-cyan-300 !px-5 !py-3 !text-slate-950 hover:!bg-cyan-200">
                {user ? 'Go to your workspace' : 'Analyze a document'} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#how-it-works" className="btn-secondary !border-slate-600 !bg-white/5 !px-5 !py-3 !text-white hover:!bg-white/10">See how it works</a>
            </div>
            <p className="mt-5 text-xs text-slate-400">PDF, DOCX, and TXT · AI-assisted screening · You stay in control</p>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-seal">Built for careful review</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">From dense language to useful next steps.</h2>
              <p className="mt-3 text-muted">Keep the source close, understand the clauses, and focus your review where it matters.</p>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }, index) => (
                <article key={title} className="panel p-5">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-seal-tint text-seal"><Icon className="h-5 w-5" aria-hidden /></div>
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted">0{index + 1}</p>
                  <h3 className="mt-1 text-base">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-y border-rule bg-white/40 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-seal">A straightforward workflow</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">Review in three steps</h2>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                ['Upload', 'Add a PDF, DOCX, or TXT contract to your private workspace.'],
                ['Analyze', 'Generate a summary, potential risk findings, and a clause overview.'],
                ['Review', 'Ask document-grounded questions, inspect citations, and compare versions.'],
              ].map(([title, text], index) => (
                <li key={title} className="panel relative p-6">
                  <span className="font-mono text-xs text-seal">STEP 0{index + 1}</span>
                  <h3 className="mt-3 text-xl">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                  {index < 2 && <Check className="absolute right-5 top-6 h-4 w-4 text-seal" aria-hidden />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="preview" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-seal">Workspace preview</p>
                <h2 className="mt-3 text-3xl sm:text-4xl">Keep findings connected to the source.</h2>
              </div>
              <p className="max-w-sm text-sm text-muted">A visual preview of the review experience. Your actual documents and analysis appear after sign-in.</p>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="about" className="px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-[#111a2a] to-[#1d2340] p-7 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200">Start your review</p>
              <h2 className="mt-3 text-2xl text-white sm:text-3xl">Make the next contract easier to understand.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Review the original wording alongside AI-generated explanations and evidence.</p>
            </div>
            <Link to={appPath} className="btn-primary shrink-0 !bg-cyan-300 !px-5 !py-3 !text-slate-950 hover:!bg-cyan-200">
              {user ? 'Open workspace' : 'Create an account'} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule px-4 py-7 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p className="max-w-2xl leading-5">InsightLens provides AI-generated information for review purposes only. It is not legal advice and is not a substitute for advice from a qualified lawyer.</p>
          {!user && <Link to="/login" className="font-medium text-seal hover:underline">Sign in</Link>}
        </div>
      </footer>
    </div>
  );
}
