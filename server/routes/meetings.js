import express from 'express';
import auth from '../middleware/auth.js';
import meetingController from '../controllers/meetingController.js';

const router = express.Router();

router.post('/', auth, meetingController.createMeeting);
router.get('/:roomCode', auth, meetingController.getMeeting);
router.patch('/:roomCode/language', auth, meetingController.updateLanguage);

export default router;
