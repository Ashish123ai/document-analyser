const Chat = require('../models/Chat');
const Document = require('../models/Document');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const ai = require('../services/aiClient');

const HISTORY_TURNS = 5; // previous Q&A pairs used to resolve follow-up questions

exports.ask = asyncHandler(async (req, res) => {
  const doc = req.document;
  if (doc.status !== 'ready') throw new ApiError(409, 'This document is not ready for questions yet');

  const question = req.body.question.trim();
  const previous = await Chat.find({ userId: req.user._id, documentId: doc._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_TURNS)
    .select('question answer');
  const history = previous.reverse().map((c) => ({ question: c.question, answer: c.answer }));

  const result = await ai.ask({ documentId: doc._id, userId: req.user._id, question, history });

  const chat = await Chat.create({
    userId: req.user._id,
    documentId: doc._id,
    question,
    answer: result.answer,
    found: result.found,
    sources: (result.sources || []).map((s) => ({ page: s.page, clause: s.clause, text: s.text, score: s.score })),
  });

  await audit(req, req.user._id, 'chat.ask', { documentId: doc._id });
  res.status(201).json({ success: true, chat });
});

exports.listForDocument = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ userId: req.user._id, documentId: req.document._id }).sort({ createdAt: 1 }).limit(200);
  res.json({ success: true, chats });
});

exports.clearForDocument = asyncHandler(async (req, res) => {
  const { deletedCount } = await Chat.deleteMany({ userId: req.user._id, documentId: req.document._id });
  res.json({ success: true, deleted: deletedCount });
});

// Cross-document history for the History page.
exports.history = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const filter = { userId: req.user._id };

  if (req.query.search) {
    const q = String(req.query.search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ question: new RegExp(q, 'i') }, { answer: new RegExp(q, 'i') }];
  }
  if (req.query.documentId) filter.documentId = req.query.documentId;

  const [chats, total] = await Promise.all([
    Chat.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('documentId', 'originalName'),
    Chat.countDocuments(filter),
  ]);

  const docs = await Document.find({ userId: req.user._id }).select('originalName');
  res.json({
    success: true,
    chats: chats.map((c) => ({
      ...c.toObject(),
      documentName: c.documentId ? c.documentId.originalName : 'Deleted document',
      documentId: c.documentId ? c.documentId._id : null,
    })),
    documents: docs,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});
