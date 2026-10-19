// Builds a downloadable Markdown report from a document's saved analysis.
const LEVEL = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };

const list = (items) => (items && items.length ? items.map((i) => `- ${i}`).join('\n') : '- Not identified');

function buildReport(doc) {
  const a = doc.analysis || {};
  const s = a.summary || {};
  const lines = [];

  lines.push(`# Legal document analysis: ${doc.originalName}`);
  lines.push('');
  lines.push(`- **Type:** ${doc.fileType.toUpperCase()}  |  **Pages:** ${doc.pageCount}  |  **Words:** ${doc.wordCount}`);
  lines.push(`- **Overall risk:** ${a.riskLevel ? LEVEL[a.riskLevel] : 'Not analyzed'}`);
  lines.push(`- **Analyzed:** ${a.analyzedAt ? new Date(a.analyzedAt).toISOString() : 'n/a'}`);
  lines.push('');
  lines.push('> AI-generated analysis for information only. It is not legal advice. Have a qualified lawyer review important agreements.');
  lines.push('');

  lines.push('## Summary');
  lines.push(s.executive_summary || 'Not available');
  lines.push('');
  lines.push(`**Contract type:** ${s.contract_type || 'Not identified'}`);
  lines.push(`**Duration:** ${s.duration || 'Not identified'}`);
  lines.push('');
  lines.push('### Parties');
  lines.push(list(s.parties));
  lines.push('### Payment terms');
  lines.push(list(s.payment_terms));
  lines.push('### Termination conditions');
  lines.push(list(s.termination_conditions));
  lines.push('### Responsibilities');
  lines.push(list(s.responsibilities));
  lines.push('### Penalties');
  lines.push(list(s.penalties));
  lines.push('### Important dates');
  lines.push(list(s.important_dates));
  lines.push('');

  lines.push('## Risks');
  if (!a.risks || !a.risks.length) lines.push('No risky clauses were flagged.');
  (a.risks || []).forEach((r, i) => {
    lines.push(`### ${i + 1}. [${LEVEL[r.level] || r.level}] ${r.title}${r.page ? ` (page ${r.page})` : ''}`);
    if (r.clauseText) lines.push(`> ${r.clauseText.replace(/\n+/g, ' ')}`);
    if (r.explanation) lines.push(`\n${r.explanation}`);
    if (r.recommendation) lines.push(`\n**Suggestion:** ${r.recommendation}`);
    lines.push('');
  });

  lines.push('## Clauses found');
  (a.clauses || []).forEach((c) => {
    lines.push(`- **${c.label}**${c.page ? ` (page ${c.page}${c.clauseRef ? `, ${c.clauseRef}` : ''})` : ''}: ${c.explanation || c.excerpt}`);
  });
  if (a.missingClauses && a.missingClauses.length) {
    lines.push('');
    lines.push(`**Not found in this document:** ${a.missingClauses.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = { buildReport };
