const express = require('express');
const auth = require('../middleware/auth');
const meetingController = require('../controllers/meetingController');

const router = express.Router();

router.post('/', auth, meetingController.createMeeting);
router.get('/:roomCode', auth, meetingController.getMeeting);
router.patch('/:roomCode/language', auth, meetingController.updateLanguage);

module.exports = router;
