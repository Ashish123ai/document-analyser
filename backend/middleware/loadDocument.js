const mongoose = require('mongoose');
const Document = require('../models/Document');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Authorization gate for every /:id document route.
// A document is looked up by BOTH its id and the logged-in user's id, so another user's
// document is indistinguishable from one that does not exist (always 404, never 403).
const loadOwnedDocument = (param = 'id', { withPath = false } = {}) =>
  asyncHandler(async (req, res, next) => {
    const id = req.params[param];
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Document not found');
    let query = Document.findOne({ _id: id, userId: req.user._id });
    if (withPath) query = query.select('+filePath');
    const doc = await query;
    if (!doc) throw new ApiError(404, 'Document not found');
    req.document = doc;
    next();
  });

module.exports = { loadOwnedDocument };
