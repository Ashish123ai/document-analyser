const mongoose = require('mongoose');

const riskSchema = new mongoose.Schema(
  {
    title: String,
    level: { type: String, enum: ['high', 'medium', 'low'] },
    category: String,
    page: Number,
    clauseText: String,
    explanation: String,
    recommendation: String,
    evidenceStrength: { type: String, enum: ['strong', 'verified_quote', 'unverified'] },
  },
  { _id: false }
);

const clauseSchema = new mongoose.Schema(
  {
    type: String,
    label: String,
    page: Number,
    clauseRef: String,
    excerpt: String,
    explanation: String,
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    filePath: { type: String, required: true, select: false }, // never sent to clients
    fileType: { type: String, enum: ['pdf', 'docx', 'txt'], required: true },
    mimeType: String,
    size: Number,
    hash: { type: String, index: true }, // sha256, used to detect duplicate uploads per user

    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    errorMessage: String,
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    wordCount: { type: Number, default: 0 },

    analysisStatus: { type: String, enum: ['none', 'running', 'done', 'failed'], default: 'none' },
    analysis: {
      summary: { type: mongoose.Schema.Types.Mixed },
      risks: [riskSchema],
      riskLevel: { type: String, enum: ['high', 'medium', 'low'] },
      riskScore: { type: Number, min: 0, max: 100 },
      riskScoreBreakdown: { type: mongoose.Schema.Types.Mixed },
      clauses: [clauseSchema],
      missingClauses: [String],
      analyzedAt: Date,
    },
  },
  { timestamps: true }
);

documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, hash: 1 });

module.exports = mongoose.model('Document', documentSchema);
