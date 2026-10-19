const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../config/logger');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  transporter = env.smtp.host
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      })
    : null;
  return transporter;
}

const emailEnabled = () => Boolean(env.smtp.host);

async function sendPasswordResetEmail(user, resetUrl) {
  const t = getTransporter();
  if (!t) {
    // No SMTP configured (local development): print the link instead.
    logger.info(`[DEV EMAIL] Password reset link for ${user.email}: ${resetUrl}`);
    return;
  }
  await t.sendMail({
    from: env.smtp.from,
    to: user.email,
    subject: 'Reset your Legal Analyzer password',
    text: `Hi ${user.name},\n\nUse this link to choose a new password. It expires in 15 minutes:\n${resetUrl}\n\nIf you did not ask for this, you can ignore this email.`,
    html: `<p>Hi ${user.name},</p><p>Use this link to choose a new password. It expires in 15 minutes.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
  });
}

module.exports = { sendPasswordResetEmail, emailEnabled };
