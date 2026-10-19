const multer = require('multer');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const env = require('../config/env');

const notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let code = err.code;
  let details = err.details;

  if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. The limit is ${env.upload.maxSizeMb} MB.`
        : err.message;
    code = err.code;
  } else if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
    logger.warn(`${req.method} ${req.originalUrl} -> 422: ${Object.values(err.errors).map((e) => `${e.path}: ${e.message}`).join('; ')}`);
  } else if (err.name === 'CastError') {
    status = 404;
    message = 'Resource not found';
  } else if (err.code === 11000) {
    status = 409;
    message = 'A record with these details already exists';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status}: ${err.stack || err.message}`);
    if (env.isProd) message = 'Internal server error';
  }

  res.status(status).json({ success: false, message, code, details });
};

module.exports = { notFound, errorHandler };
