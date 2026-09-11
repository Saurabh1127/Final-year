const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middleware/auth');
const summaryController = require('../controllers/summaryController');

router.post('/:meetingId/summarize', authMiddleware, summaryController.summarizeMeeting);
router.get('/:meetingId/summary', authMiddleware, summaryController.getSummary);

module.exports = router;
