const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Document = require('../models/Document');
const Chat = require('../models/Chat');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const logger = require('../config/logger');
const ai = require('../services/aiClient');
const { verifyMagicBytes } = require('../middleware/upload');
const { buildReport } = require('../services/reportService');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const removeFile = (p) => p && fs.promises.unlink(p).catch(() => {});

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

// Runs in the background after the upload response has been sent.
async function processInBackground(doc) {
  try {
    const result = await ai.processDocument({
      filePath: doc.filePath,
      fileName: doc.originalName,
      fileType: doc.fileType,
      documentId: doc._id,
      userId: doc.userId,
    });
    doc.status = 'ready';
    doc.errorMessage = undefined;
    doc.pageCount = result.page_count;
    doc.chunkCount = result.chunk_count;
    doc.wordCount = result.word_count;
  } catch (err) {
    logger.error(`Processing failed for document ${doc._id}: ${err.message}`);
    doc.status = 'failed';
    doc.errorMessage = err.message;
  }
  await doc.save();
}

exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file received. Attach a file in the "file" field.');

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!verifyMagicBytes(req.file.path, ext)) {
    await removeFile(req.file.path);
    throw new ApiError(415, 'The file contents do not match its extension.', 'BAD_FILE_CONTENT');
  }

  const hash = await hashFile(req.file.path);
  const duplicate = await Document.findOne({ userId: req.user._id, hash });
  if (duplicate) {
    await removeFile(req.file.path);
    throw new ApiError(409, `You already uploaded this file as "${duplicate.originalName}".`, 'DUPLICATE');
  }

  const doc = await Document.create({
    userId: req.user._id,
    originalName: path.basename(req.file.originalname),
    storedName: req.file.filename,
    filePath: req.file.path,
    fileType: ext.slice(1),
    mimeType: req.file.mimetype,
    size: req.file.size,
    hash,
    status: 'processing',
  });

  await audit(req, req.user._id, 'document.upload', { documentId: doc._id, name: doc.originalName });
  res.status(201).json({ success: true, document: await Document.findById(doc._id) });

  processInBackground(doc);
});

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);

  const filter = { userId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.risk) filter['analysis.riskLevel'] = req.query.risk;
  if (req.query.search) filter.originalName = new RegExp(escapeRegex(String(req.query.search).slice(0, 80)), 'i');

  const [documents, total] = await Promise.all([
    Document.find(filter)
      .select('-analysis.clauses -analysis.risks.clauseText')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Document.countDocuments(filter),
  ]);

  res.json({ success: true, documents, total, page, pages: Math.ceil(total / limit) || 1 });
});

exports.get = (req, res) => res.json({ success: true, document: req.document });

exports.download = asyncHandler(async (req, res) => {
  const doc = req.document;
  if (!fs.existsSync(doc.filePath)) throw new ApiError(410, 'The original file is no longer available');
  await audit(req, req.user._id, 'document.download', { documentId: doc._id });
  res.download(doc.filePath, doc.originalName);
});

exports.reprocess = asyncHandler(async (req, res) => {
  const doc = req.document;
  if (doc.status === 'processing') throw new ApiError(409, 'This document is already being processed');
  doc.status = 'processing';
  doc.errorMessage = undefined;
  await doc.save();
  res.status(202).json({ success: true, document: await Document.findById(doc._id) });
  processInBackground(doc);
});

exports.remove = asyncHandler(async (req, res) => {
  const doc = req.document;
  // Best effort on the AI side: if it is down we still delete our own records.
  await ai.deleteDocument(doc._id, req.user._id).catch((e) => logger.warn(`vector cleanup failed: ${e.message}`));
  await removeFile(doc.filePath);
  await Chat.deleteMany({ documentId: doc._id, userId: req.user._id });
  await doc.deleteOne();
  await audit(req, req.user._id, 'document.delete', { documentId: doc._id, name: doc.originalName });
  res.json({ success: true, message: 'Document deleted' });
});

exports.analyze = asyncHandler(async (req, res) => {
  const doc = req.document;
  if (doc.status !== 'ready') throw new ApiError(409, 'The document is not ready for analysis yet');
  if (doc.analysisStatus === 'running') throw new ApiError(409, 'Analysis is already running');

  doc.analysisStatus = 'running';
  await doc.save();

  try {
    const uid = req.user._id;
    const [summary, risk, clauses] = await Promise.all([
      ai.summarize(doc._id, uid),
      ai.analyzeRisk(doc._id, uid),
      ai.detectClauses(doc._id, uid),
    ]);

    doc.analysis = {
      summary,
      riskLevel: risk.risk_level,
      risks: risk.risks.map((r) => ({
        title: r.title,
        level: r.level,
        category: r.category,
        page: r.page,
        clauseText: r.clause_text,
        explanation: r.explanation,
        recommendation: r.recommendation,
      })),
      clauses: clauses.clauses.map((c) => ({
        type: c.type,
        label: c.label,
        page: c.page,
        clauseRef: c.clause_ref,
        excerpt: c.excerpt,
        explanation: c.explanation,
      })),
      missingClauses: clauses.missing,
      analyzedAt: new Date(),
    };
    doc.analysisStatus = 'done';
    await doc.save();
    await audit(req, uid, 'document.analyze', { documentId: doc._id, riskLevel: risk.risk_level });
    res.json({ success: true, document: doc });
  } catch (err) {
    doc.analysisStatus = 'failed';
    await doc.save();
    throw err;
  }
});

exports.report = (req, res) => {
  const doc = req.document;
  if (doc.analysisStatus !== 'done') throw new ApiError(409, 'Analyze the document first to export a report');
  const filename = `${path.parse(doc.originalName).name}-analysis.md`;
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buildReport(doc));
};
