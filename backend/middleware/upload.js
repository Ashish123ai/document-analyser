const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.txt': ['text/plain'],
};

const uploadRoot = path.resolve(env.upload.dir);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    // One private folder per user. Not served statically.
    const dir = path.join(uploadRoot, String(req.user._id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED[ext] || !ALLOWED[ext].includes(file.mimetype)) {
    return cb(new ApiError(415, 'Unsupported file. Upload a PDF, DOCX or TXT file.', 'UNSUPPORTED_TYPE'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.upload.maxSizeMb * 1024 * 1024, files: 1 },
});

// Content check: the extension and MIME type come from the client, so also verify the file's real signature.
function verifyMagicBytes(filePath, ext) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(4096);
  const bytes = fs.readSync(fd, buf, 0, 4096, 0);
  fs.closeSync(fd);
  const head = buf.subarray(0, bytes);

  if (ext === '.pdf') return head.subarray(0, 5).toString('latin1') === '%PDF-';
  if (ext === '.docx') return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (ext === '.txt') return !head.includes(0x00); // plain text never contains NUL bytes
  return false;
}

module.exports = { upload, verifyMagicBytes, uploadRoot };
