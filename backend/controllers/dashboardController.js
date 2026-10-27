const mongoose = require('mongoose');
const Document = require('../models/Document');
const Chat = require('../models/Chat');
const asyncHandler = require('../utils/asyncHandler');

exports.stats = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);

  const [documents, ready, analyzed, questions, analyzedDocs, recentDocuments, recentChats] = await Promise.all([
    Document.countDocuments({ userId }),
    Document.countDocuments({ userId, status: 'ready' }),
    Document.countDocuments({ userId, analysisStatus: 'done' }),
    Chat.countDocuments({ userId }),
    // Counting in application code (a user has a modest number of documents) avoids
    // database-specific aggregation behaviour and keeps the logic easy to read and test.
    Document.find({ userId, analysisStatus: 'done' }).select('analysis.riskLevel analysis.riskScore analysis.risks.level').lean(),
    Document.find({ userId }).sort({ createdAt: -1 }).limit(5).select('originalName fileType status pageCount analysis.riskLevel createdAt'),
    Chat.find({ userId }).sort({ createdAt: -1 }).limit(5).populate('documentId', 'originalName').select('question documentId createdAt found'),
  ]);

  const risksByLevel = { high: 0, medium: 0, low: 0 };
  const documentsByRisk = { high: 0, medium: 0, low: 0 };
  const riskScoreBuckets = { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 };
  let totalRiskScore = 0;
  let riskScoreCount = 0;
  for (const d of analyzedDocs) {
    for (const r of d.analysis?.risks || []) if (risksByLevel[r.level] !== undefined) risksByLevel[r.level] += 1;
    if (documentsByRisk[d.analysis?.riskLevel] !== undefined) documentsByRisk[d.analysis.riskLevel] += 1;
    const score = d.analysis?.riskScore;
    if (Number.isFinite(score)) {
      totalRiskScore += score;
      riskScoreCount += 1;
      const bucket = score < 20 ? '0-19' : score < 40 ? '20-39' : score < 60 ? '40-59' : score < 80 ? '60-79' : '80-100';
      riskScoreBuckets[bucket] += 1;
    }
  }

  res.json({
    success: true,
    stats: {
      documents,
      ready,
      analyzed,
      questions,
      risksFound: risksByLevel.high + risksByLevel.medium + risksByLevel.low,
      risksByLevel,
      documentsByRisk,
      averageRiskScore: riskScoreCount ? Math.round(totalRiskScore / riskScoreCount) : null,
      riskScoreBuckets,
    },
    recentDocuments,
    recentQuestions: recentChats.map((c) => ({
      id: c._id,
      question: c.question,
      found: c.found,
      createdAt: c.createdAt,
      documentId: c.documentId ? c.documentId._id : null,
      documentName: c.documentId ? c.documentId.originalName : 'Deleted document',
    })),
  });
});
