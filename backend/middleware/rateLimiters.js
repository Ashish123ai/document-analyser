const rateLimit = require('express-rate-limit');

const base = { standardHeaders: true, legacyHeaders: false };

const globalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Login / register / forgot-password
const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 25,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
});

// Expensive LLM-backed endpoints, keyed per user
const aiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req.user ? String(req.user._id) : req.ip),
  message: { success: false, message: 'AI request limit reached. Wait a minute and try again.' },
});

const uploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 40,
  keyGenerator: (req) => (req.user ? String(req.user._id) : req.ip),
  message: { success: false, message: 'Upload limit reached. Try again later.' },
});

module.exports = { globalLimiter, authLimiter, aiLimiter, uploadLimiter };
