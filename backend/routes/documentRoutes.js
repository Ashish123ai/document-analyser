const router = require('express').Router();
const c = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const { loadOwnedDocument } = require('../middleware/loadDocument');
const { upload } = require('../middleware/upload');
const { aiLimiter, uploadLimiter } = require('../middleware/rateLimiters');

router.use(protect);

router.get('/', c.list);
router.post('/', uploadLimiter, upload.single('file'), c.upload);
router.post('/compare', aiLimiter, c.compare);

router.get('/:id', loadOwnedDocument(), c.get);
router.get('/:id/download', loadOwnedDocument('id', { withPath: true }), c.download);
router.get('/:id/report', loadOwnedDocument(), c.report);
router.post('/:id/analyze', aiLimiter, loadOwnedDocument(), c.analyze);
router.post('/:id/reprocess', uploadLimiter, loadOwnedDocument('id', { withPath: true }), c.reprocess);
router.delete('/:id', loadOwnedDocument('id', { withPath: true }), c.remove);

module.exports = router;
