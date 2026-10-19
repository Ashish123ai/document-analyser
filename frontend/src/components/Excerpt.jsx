import { highlightParts } from '../utils/format.js';

// A passage quoted from the user's document: page and clause sit in the margin, matched words are highlighted.
export default function Excerpt({ page, clause, text, terms = [], id, className = '' }) {
  return (
    <figure id={id} className={`flex gap-3 ${className}`}>
      <figcaption className="w-16 shrink-0 pt-1 text-right text-xs leading-snug text-muted">
        {page ? <span className="block font-semibold text-ink">p. {page}</span> : null}
        {clause ? <span className="block">{clause}</span> : null}
      </figcaption>
      <blockquote className="quote min-w-0 flex-1">
        {highlightParts(text, terms).map((part, i) => (part.hit ? <mark key={i} className="hl">{part.text}</mark> : <span key={i}>{part.text}</span>))}
      </blockquote>
    </figure>
  );
}
