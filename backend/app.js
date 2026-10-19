const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const env = require('./config/env');
const logger = require('./config/logger');
const { globalLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

if (env.isProd) app.set('trust proxy', 1); // correct client IPs behind nginx / a load balancer

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize()); // strips $ and . operators from input to block NoSQL injection
if (env.nodeEnv !== 'test') {
  app.use(morgan(env.isProd ? 'combined' : 'dev', { stream: { write: (m) => logger.http(m.trim()) } }));
}
app.use(globalLimiter);

app.use('/api', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
