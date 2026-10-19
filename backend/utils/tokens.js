const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function sign(user, type, secret, expiresIn) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: String(user._id || user.id), tv: user.tokenVersion || 0, type },
    secret,
    { expiresIn, jwtid: jti }
  );
  return { token, jti };
}

const signAccessToken = (user) => sign(user, 'access', env.jwt.accessSecret, env.jwt.accessExpires);
const signRefreshToken = (user) => sign(user, 'refresh', env.jwt.refreshSecret, env.jwt.refreshExpires);

function verify(token, secret, expectedType) {
  const payload = jwt.verify(token, secret);
  if (payload.type !== expectedType) {
    const err = new Error('Wrong token type');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return payload;
}

const verifyAccessToken = (token) => verify(token, env.jwt.accessSecret, 'access');
const verifyRefreshToken = (token) => verify(token, env.jwt.refreshSecret, 'refresh');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  sha256,
};
