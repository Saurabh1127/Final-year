import express from 'express';
const router = express.Router({ mergeParams: true });
import authMiddleware from '../middleware/auth.js';
import summaryController from '../controllers/summaryController.js';

router.post('/:meetingId/summarize', authMiddleware, summaryController.summarizeMeeting);
router.get('/:meetingId/summary', authMiddleware, summaryController.getSummary);

export default router;
