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
    Document.find({ userId, analysisStatus: 'done' }).select('analysis.riskLevel analysis.risks.level').lean(),
    Document.find({ userId }).sort({ createdAt: -1 }).limit(5).select('originalName fileType status pageCount analysis.riskLevel createdAt'),
    Chat.find({ userId }).sort({ createdAt: -1 }).limit(5).populate('documentId', 'originalName').select('question documentId createdAt found'),
  ]);

  const risksByLevel = { high: 0, medium: 0, low: 0 };
  const documentsByRisk = { high: 0, medium: 0, low: 0 };
  for (const d of analyzedDocs) {
    for (const r of d.analysis?.risks || []) if (risksByLevel[r.level] !== undefined) risksByLevel[r.level] += 1;
    if (documentsByRisk[d.analysis?.riskLevel] !== undefined) documentsByRisk[d.analysis.riskLevel] += 1;
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
