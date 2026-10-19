const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema(
  {
    page: Number,
    clause: String,
    text: String,
    score: Number,
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    question: { type: String, required: true, maxlength: 1000 },
    answer: { type: String, required: true },
    found: { type: Boolean, default: true }, // false when the document did not contain the answer
    sources: [sourceSchema],
  },
  { timestamps: true }
);

chatSchema.index({ userId: 1, documentId: 1, createdAt: 1 });

module.exports = mongoose.model('Chat', chatSchema);
