const router = require('express').Router();
const c = require('../controllers/userController');
const v = require('../middleware/validators');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/profile', c.getProfile);
router.put('/profile', v.profile, validate, c.updateProfile);
router.get('/activity', c.activity);
router.delete('/account', v.deleteAccount, validate, c.deleteAccount);

module.exports = router;
