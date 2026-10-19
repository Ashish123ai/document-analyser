const router = require('express').Router();
const c = require('../controllers/chatController');
const v = require('../middleware/validators');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/authMiddleware');
const { loadOwnedDocument } = require('../middleware/loadDocument');
const { aiLimiter } = require('../middleware/rateLimiters');

router.use(protect);

router.get('/', c.history);
router.get('/:documentId', loadOwnedDocument('documentId'), c.listForDocument);
router.post('/:documentId', aiLimiter, loadOwnedDocument('documentId'), v.question, validate, c.ask);
router.delete('/:documentId', loadOwnedDocument('documentId'), c.clearForDocument);

module.exports = router;
