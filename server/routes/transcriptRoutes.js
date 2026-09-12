import express from 'express';
const router = express.Router();
import authMiddleware from '../middleware/auth.js';
import transcriptController from '../controllers/transcriptController.js';

router.post('/', authMiddleware, transcriptController.createTranscript);
router.get('/:meetingId', authMiddleware, transcriptController.getTranscripts);

export default router;
