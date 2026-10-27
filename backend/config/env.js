require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

function secret(name, devDefault) {
  const value = process.env[name];
  if (value && !value.startsWith('change-me')) return value;
  if (isProd) {
    throw new Error(`Missing required secret ${name}. Set a strong random value in production.`);
  }
  return value || devDefault;
}

const env = {
  nodeEnv,
  isProd,
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/legal_analyzer',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET', 'dev-access-secret-do-not-use-in-prod'),
    refreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret-do-not-use-in-prod'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '30m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  ai: {
    url: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
    key: secret('AI_INTERNAL_KEY', 'dev-internal-key'),
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || 600000,
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSizeMb: parseInt(process.env.MAX_UPLOAD_MB, 10) || 200,
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Legal Analyzer <no-reply@legal-analyzer.local>',
  },
};

module.exports = env;
