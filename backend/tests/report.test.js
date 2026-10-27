const { buildReport } = require('../services/reportService');
const { calculateRiskScore } = require('../services/riskScore');
const { verifyMagicBytes } = require('../middleware/upload');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('report builder', () => {
  it('renders risks and summary into markdown', () => {
    const md = buildReport({
      originalName: 'lease.pdf',
      fileType: 'pdf',
      pageCount: 4,
      wordCount: 900,
      analysis: {
        riskLevel: 'high',
        riskScore: 56,
        riskScoreBreakdown: { formula: 'Weighted test formula.' },
        analyzedAt: new Date('2026-01-01'),
        summary: { executive_summary: 'A residential lease.', parties: ['A', 'B'] },
        risks: [{ title: 'Unlimited liability', level: 'high', page: 2, explanation: 'No cap.' }],
        clauses: [{ label: 'Termination', page: 3, clauseRef: 'Clause 8', explanation: '30 days notice' }],
        missingClauses: ['Governing law'],
      },
    });
    expect(md).toContain('# Legal document analysis: lease.pdf');
    expect(md).toContain('[HIGH] Unlimited liability');
    expect(md).toContain('Governing law');
    expect(md).toContain('Risk score:** 56/100');
    expect(md).toContain('Weighted test formula.');
  });
});

describe('risk score', () => {
  it('uses documented weights, missing-clause points and a 100-point cap', () => {
    expect(calculateRiskScore([{ level: 'high' }, { level: 'medium' }, { level: 'low' }], ['Payment']))
      .toMatchObject({ score: 48, riskPoints: 40, missingClausePoints: 8 });
    expect(calculateRiskScore(Array(5).fill({ level: 'high' }), ['Payment', 'Liability']))
      .toMatchObject({ score: 100 });
  });
});

describe('magic byte verification', () => {
  const tmp = (name, data) => {
    const p = path.join(os.tmpdir(), `${Date.now()}-${name}`);
    fs.writeFileSync(p, data);
    return p;
  };

  it('accepts real signatures and rejects disguised files', () => {
    expect(verifyMagicBytes(tmp('a.pdf', '%PDF-1.7 hello'), '.pdf')).toBe(true);
    expect(verifyMagicBytes(tmp('b.pdf', 'MZ not a pdf'), '.pdf')).toBe(false);
    expect(verifyMagicBytes(tmp('c.docx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 1])), '.docx')).toBe(true);
    expect(verifyMagicBytes(tmp('d.txt', 'plain text'), '.txt')).toBe(true);
    expect(verifyMagicBytes(tmp('e.txt', Buffer.from([0x41, 0x00, 0x42])), '.txt')).toBe(false);
  });
});
