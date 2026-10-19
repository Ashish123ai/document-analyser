const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const http = axios.create({
  baseURL: env.ai.url,
  timeout: env.ai.timeoutMs,
  headers: { 'X-Internal-Key': env.ai.key },
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
});

// Translate low-level axios errors into clean API errors.
function toApiError(err) {
  if (err.response) {
    const { status, data } = err.response;
    const detail = typeof data?.detail === 'string' ? data.detail : 'The AI service could not complete the request';
    logger.warn(`AI service responded ${status}: ${detail}`);
    if (status >= 400 && status < 500 && status !== 401 && status !== 403) {
      return new ApiError(status === 404 ? 409 : 422, detail, 'AI_REJECTED');
    }
    return new ApiError(502, detail, 'AI_ERROR');
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return new ApiError(503, 'The AI service is unavailable. Please try again shortly.', 'AI_UNAVAILABLE');
  }
  if (err.code === 'ECONNABORTED') {
    return new ApiError(504, 'The AI service took too long to respond.', 'AI_TIMEOUT');
  }
  return new ApiError(502, err.message, 'AI_ERROR');
}

async function call(fn) {
  try {
    const res = await fn();
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

const ids = (documentId, userId) => ({ document_id: String(documentId), user_id: String(userId) });

module.exports = {
  processDocument({ filePath, fileName, fileType, documentId, userId }) {
    return call(() => {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), { filename: fileName });
      form.append('document_id', String(documentId));
      form.append('user_id', String(userId));
      form.append('file_type', fileType);
      return http.post('/process-document', form, { headers: form.getHeaders() });
    });
  },

  ask({ documentId, userId, question, history }) {
    return call(() => http.post('/ask', { ...ids(documentId, userId), question, history, top_k: 5 }));
  },

  summarize(documentId, userId) {
    return call(() => http.post('/summarize', ids(documentId, userId)));
  },

  analyzeRisk(documentId, userId) {
    return call(() => http.post('/analyze-risk', ids(documentId, userId)));
  },

  detectClauses(documentId, userId) {
    return call(() => http.post('/detect-clauses', ids(documentId, userId)));
  },

  deleteDocument(documentId, userId) {
    return call(() => http.delete(`/documents/${documentId}`, { params: { user_id: String(userId) } }));
  },

  health() {
    return call(() => http.get('/health', { timeout: 4000 }));
  },
};
