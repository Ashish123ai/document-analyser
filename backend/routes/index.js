const router = require('express').Router();
const mongoose = require('mongoose');
const ai = require('../services/aiClient');

// Health check (no auth): used by Docker/Kubernetes and the README demo.
router.get('/health', async (req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  let aiOk = false;
  try {
    aiOk = (await ai.health()).status === 'ok';
  } catch {
    aiOk = false;
  }
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ok' : 'degraded', database: dbOk, aiService: aiOk, uptime: process.uptime() });
});

router.use('/auth', require('./authRoutes'));
router.use('/documents', require('./documentRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/user', require('./userRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));

module.exports = router;
