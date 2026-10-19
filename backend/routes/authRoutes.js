const router = require('express').Router();
const c = require('../controllers/authController');
const v = require('../middleware/validators');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiters');

router.post('/register', authLimiter, v.register, validate, c.register);
router.post('/login', authLimiter, v.login, validate, c.login);
router.post('/refresh', authLimiter, v.refresh, validate, c.refresh);
router.post('/forgot-password', authLimiter, v.forgot, validate, c.forgotPassword);
router.post('/reset-password', authLimiter, v.reset, validate, c.resetPassword);

router.post('/logout', protect, c.logout);
router.get('/validate', protect, c.validate);
router.post('/change-password', protect, v.changePassword, validate, c.changePassword);

module.exports = router;
