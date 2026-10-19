const mongoose = require('mongoose');

// Blacklist of logged-out tokens. MongoDB removes rows automatically after the token would have expired.
const revokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('RevokedToken', revokedTokenSchema);
