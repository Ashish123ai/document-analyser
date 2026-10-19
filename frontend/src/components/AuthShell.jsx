import { Link } from 'react-router-dom';
import { Logo } from './Layout.jsx';

// The marketing side of the sign-in screens: a clause with a highlight and a margin note,
// the same visual language the app uses for cited text.
function ClauseSheet() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="rounded-md bg-white p-6 text-ink shadow-xl">
        <p className="text-xs font-medium text-muted">Lease agreement, page 4</p>
        <p className="mt-3 font-serif text-[16px] leading-[1.75]">
          <span className="font-semibold">7.2 Renewal.</span> This Agreement{' '}
          <mark className="hl">shall automatically renew for successive twelve-month terms</mark> unless either party gives sixty (60) days' written notice before the end of the then-current term.
        </p>
      </div>
      <div className="relative -mt-2 ml-8 rounded-md border-l-4 border-[#E3A21A] bg-med-tint p-4 text-sm text-ink shadow-lg">
        <p className="font-semibold text-med">Medium risk: automatic renewal</p>
        <p className="mt-1">Easy to miss. Put the cancellation deadline in your calendar.</p>
      </div>
      <div className="mt-5 space-y-2 text-sm">
        <p className="ml-auto w-fit max-w-[85%] rounded-md bg-white/10 px-3 py-2 text-white">What is the notice period?</p>
        <p className="w-fit max-w-[90%] rounded-md bg-white px-3 py-2 text-ink">Sixty days of written notice before the term ends. <span className="text-muted">Page 4, Clause 7.2</span></p>
      </div>
    </div>
  );
}

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between gap-8 bg-ink px-12 py-10 lg:flex">
        <Logo light />
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-white xl:text-4xl">Know what you are signing before you sign it.</h2>
          <p className="mt-4 max-w-md text-[15px] text-white/70">Upload a contract, see the risky clauses, and ask questions in plain English. Every answer is quoted from your own document.</p>
          <div className="mt-8"><ClauseSheet /></div>
        </div>
        <p className="text-xs text-white/50">AI-generated analysis for information only. Not legal advice.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <p className="mt-6 text-center text-sm text-muted">{footer}</p>}
        </div>
      </section>
    </div>
  );
}

export const AuthLink = ({ to, children }) => <Link to={to} className="font-medium text-seal hover:underline">{children}</Link>;
