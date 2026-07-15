const express = require('express');
const Meeting = require('../models/Meeting');
const auth = require('../middleware/auth');

const router = express.Router();

// POST /api/meetings — Create a new meeting
router.post('/', auth, async (req, res) => {
  try {
    const { title } = req.body;

    // Generate unique room code
    let roomCode;
    let attempts = 0;
    do {
      roomCode = Meeting.generateRoomCode();
      const existing = await Meeting.findOne({ roomCode });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ message: 'Failed to generate unique room code.' });
    }

    const meeting = await Meeting.create({
      roomCode,
      title: title || `${req.user.name}'s Meeting`,
      hostId: req.userId,
      status: 'waiting',
      participants: [
        {
          userId: req.userId,
          displayName: req.user.name,
          targetLanguage: req.user.preferredLanguage || 'en',
          isActive: false, // Will become active when they join via socket
        },
      ],
    });

    res.status(201).json({
      meetingId: meeting._id,
      roomCode: meeting.roomCode,
      title: meeting.title,
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Failed to create meeting.' });
  }
});

// GET /api/meetings/:roomCode — Get meeting details
router.get('/:roomCode', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      roomCode: req.params.roomCode,
      status: { $ne: 'ended' },
    });

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found or has ended.' });
    }

    const activeParticipants = meeting.getActiveParticipants();

    res.json({
      meetingId: meeting._id,
      roomCode: meeting.roomCode,
      title: meeting.title,
      hostId: meeting.hostId,
      status: meeting.status,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        targetLanguage: p.targetLanguage,
        isActive: p.isActive,
      })),
      participantCount: activeParticipants.length,
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Failed to fetch meeting.' });
  }
});

// PATCH /api/meetings/:roomCode/language — Update participant's target language
router.patch('/:roomCode/language', auth, async (req, res) => {
  try {
    const { targetLanguage } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({ message: 'targetLanguage is required.' });
    }

    const meeting = await Meeting.findOne({ roomCode: req.params.roomCode });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' });
    }

    const participant = meeting.participants.find(
      (p) => p.userId.toString() === req.userId
    );

    if (!participant) {
      return res.status(403).json({ message: 'You are not in this meeting.' });
    }

    participant.targetLanguage = targetLanguage;
    await meeting.save();

    res.json({ message: 'Language updated.', targetLanguage });
  } catch (error) {
    console.error('Update language error:', error);
    res.status(500).json({ message: 'Failed to update language.' });
  }
});

module.exports = router;
