import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-serif text-6xl text-ink/20">§ 404</p>
        <h1 className="mt-2 text-2xl">This page does not exist</h1>
        <p className="mt-2 text-sm text-muted">The link may be broken, or the page may have been moved.</p>
        <Link to="/dashboard" className="btn-primary mt-6">Go to dashboard</Link>
      </div>
    </div>
  );
}
