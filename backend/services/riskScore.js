function calculateRiskScore(risks, missingClauses) {
  const riskPoints = risks.reduce((sum, risk) => sum + ({ high: 24, medium: 12, low: 4 }[risk.level] || 0), 0);
  const missingPoints = missingClauses.length * 8;
  return {
    score: Math.min(100, riskPoints + missingPoints),
    riskPoints,
    missingClausePoints: missingPoints,
    formula: '24 per high, 12 per medium, 4 per low finding, plus 8 per missing expected clause; capped at 100.',
  };
}

module.exports = { calculateRiskScore };
