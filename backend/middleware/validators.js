const { body } = require('express-validator');

const password = (field = 'password') =>
  body(field)
    .isString().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8 to 128 characters')
    .matches(/[a-z]/).withMessage('Password needs a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password needs an uppercase letter')
    .matches(/\d/).withMessage('Password needs a number');

const email = body('email').isString().trim().isEmail().withMessage('Enter a valid email address').isLength({ max: 254 });

exports.register = [
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2 to 80 characters'),
  email,
  password(),
];

exports.login = [email, body('password').isString().notEmpty().withMessage('Password is required')];
exports.forgot = [email];
exports.reset = [
  body('token').isString().isLength({ min: 20, max: 200 }).withMessage('Reset token is missing'),
  password(),
];
exports.refresh = [body('refreshToken').isString().notEmpty().withMessage('Refresh token is required')];
exports.changePassword = [
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  password('newPassword'),
];
exports.profile = [body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2 to 80 characters')];
exports.deleteAccount = [body('password').isString().notEmpty().withMessage('Password is required')];
exports.question = [
  body('question').isString().trim().isLength({ min: 3, max: 1000 }).withMessage('Question must be 3 to 1000 characters'),
];
