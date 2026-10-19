const crypto = require('crypto');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const env = require('../config/env');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  sha256,
} = require('../utils/tokens');
const { sendPasswordResetEmail, emailEnabled } = require('../services/emailService');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RESET_TOKEN_MINUTES = 15;

function issueTokens(user) {
  return {
    accessToken: signAccessToken(user).token,
    refreshToken: signRefreshToken(user).token,
  };
}

const revoke = (jti, expSeconds) =>
  RevokedToken.updateOne({ jti }, { jti, expiresAt: new Date(expSeconds * 1000) }, { upsert: true });

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email: email.toLowerCase() })) {
    throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
  }

  const user = new User({ name, email });
  await user.setPassword(password);
  user.lastLoginAt = new Date();
  await user.save();

  await audit(req, user._id, 'auth.register');
  res.status(201).json({ success: true, user: user.toSafeJSON(), ...issueTokens(user) });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  // Same message for "no such user" and "wrong password" so emails cannot be enumerated.
  const invalid = new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  if (!user) throw invalid;

  if (user.isLocked()) {
    const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(423, `Too many failed attempts. Try again in ${minutes} minute(s).`, 'ACCOUNT_LOCKED');
  }

  if (!(await user.comparePassword(password))) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
      user.failedLoginAttempts = 0;
      await audit(req, user._id, 'auth.account_locked');
    }
    await user.save();
    await audit(req, user._id, 'auth.login_failed');
    throw invalid;
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  await audit(req, user._id, 'auth.login');
  res.json({ success: true, user: user.toSafeJSON(), ...issueTokens(user) });
});

// Exchange a valid refresh token for a new access + refresh pair (refresh-token rotation).
exports.refresh = asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = verifyRefreshToken(req.body.refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH');
  }

  if (await RevokedToken.exists({ jti: payload.jti })) {
    throw new ApiError(401, 'Refresh token has already been used', 'REFRESH_REUSED');
  }
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) {
    throw new ApiError(401, 'Session is no longer valid', 'TOKEN_INVALIDATED');
  }

  await revoke(payload.jti, payload.exp); // one-time use
  res.json({ success: true, user: user.toSafeJSON(), ...issueTokens(user) });
});

exports.logout = asyncHandler(async (req, res) => {
  await revoke(req.token.jti, req.token.exp);
  if (req.body.refreshToken) {
    try {
      const p = verifyRefreshToken(req.body.refreshToken);
      if (p.sub === String(req.user._id)) await revoke(p.jti, p.exp);
    } catch {
      /* an already-invalid refresh token needs no revocation */
    }
  }
  await audit(req, req.user._id, 'auth.logout');
  res.json({ success: true, message: 'Signed out' });
});

// Used by the frontend on app start to confirm a stored token is still valid.
exports.validate = (req, res) => {
  res.json({ success: true, valid: true, user: req.user.toSafeJSON(), expiresAt: req.token.exp * 1000 });
};

exports.forgotPassword = asyncHandler(async (req, res) => {
  const response = { success: true, message: 'If an account exists for that email, a reset link has been sent.' };
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  if (!user) return res.json(response); // never reveal whether the email exists

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = sha256(rawToken); // store only the hash
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60000);
  await user.save();

  const resetUrl = `${env.clientUrl}/reset-password/${rawToken}`;
  try {
    await sendPasswordResetEmail(user, resetUrl);
  } catch (err) {
    throw new ApiError(502, 'Could not send the reset email. Try again later.', 'EMAIL_FAILED');
  }

  await audit(req, user._id, 'auth.password_reset_requested');
  // Convenience for local demos only: expose the link when no SMTP server is configured.
  if (!env.isProd && !emailEnabled()) response.devResetUrl = resetUrl;
  res.json(response);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    passwordResetToken: sha256(req.body.token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired', 'INVALID_RESET_TOKEN');

  await user.setPassword(req.body.password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.tokenVersion += 1; // signs out every existing session
  await user.save();

  await audit(req, user._id, 'auth.password_reset');
  res.json({ success: true, message: 'Password updated. You can now sign in.' });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect', 'WRONG_PASSWORD');
  }
  await user.setPassword(req.body.newPassword);
  user.tokenVersion += 1;
  await user.save();

  await audit(req, user._id, 'auth.password_changed');
  // The old tokens are now invalid, so hand the browser a fresh pair.
  res.json({ success: true, message: 'Password changed', ...issueTokens(user) });
});
