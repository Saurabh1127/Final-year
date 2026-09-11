const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const transcriptController = require('../controllers/transcriptController');

router.post('/', authMiddleware, transcriptController.createTranscript);
router.get('/:meetingId', authMiddleware, transcriptController.getTranscripts);

module.exports = router;
