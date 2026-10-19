const fs = require('fs');
const User = require('../models/User');
const Document = require('../models/Document');
const Chat = require('../models/Chat');
const AuditLog = require('../models/AuditLog');
const RevokedToken = require('../models/RevokedToken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const ai = require('../services/aiClient');

exports.getProfile = (req, res) => res.json({ success: true, user: req.user.toSafeJSON() });

exports.updateProfile = asyncHandler(async (req, res) => {
  req.user.name = req.body.name;
  await req.user.save();
  await audit(req, req.user._id, 'user.profile_updated');
  res.json({ success: true, user: req.user.toSafeJSON() });
});

exports.activity = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30).select('action ip createdAt meta');
  res.json({ success: true, activity: logs });
});

exports.deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(req.body.password))) {
    throw new ApiError(400, 'Password is incorrect', 'WRONG_PASSWORD');
  }

  const docs = await Document.find({ userId: user._id }).select('+filePath');
  for (const d of docs) {
    await ai.deleteDocument(d._id, user._id).catch(() => {});
    if (d.filePath) await fs.promises.unlink(d.filePath).catch(() => {});
  }
  await Promise.all([
    Document.deleteMany({ userId: user._id }),
    Chat.deleteMany({ userId: user._id }),
    AuditLog.deleteMany({ userId: user._id }),
  ]);
  await RevokedToken.updateOne({ jti: req.token.jti }, { jti: req.token.jti, expiresAt: new Date(req.token.exp * 1000) }, { upsert: true });
  await user.deleteOne();
  res.json({ success: true, message: 'Account and all data deleted' });
});
