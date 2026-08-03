const express = require('express');
const router = express.Router();
const Transcript = require('../models/Transcript');
const authMiddleware = require('../middleware/auth');

/**
 * POST /api/transcripts
 * Save a new transcript entry from the React frontend (after FastAPI translation).
 * Broadcasts the new entry to all room participants via Socket.IO.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      meetingId,
      speakerId,
      speakerName,
      sourceLanguage,
      originalText,
      translations,
    } = req.body;

    if (!meetingId || !speakerId || !originalText) {
      return res.status(400).json({
        success: false,
        message: 'meetingId, speakerId, and originalText are required.',
      });
    }

    const entry = await Transcript.create({
      meetingId,
      speakerId,
      speakerName: speakerName || 'Anonymous',
      sourceLanguage: sourceLanguage || 'auto',
      originalText,
      translations: translations || {},
    });

    // Broadcast to all participants in this meeting room via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(meetingId).emit('new-transcript', {
        _id: entry._id,
        meetingId: entry.meetingId,
        speakerId: entry.speakerId,
        speakerName: entry.speakerName,
        sourceLanguage: entry.sourceLanguage,
        originalText: entry.originalText,
        translations: Object.fromEntries(entry.translations || new Map()),
        timestamp: entry.timestamp,
      });
    }

    return res.status(201).json({ success: true, data: entry });
  } catch (err) {
    console.error('❌ [Transcript] POST error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error saving transcript.' });
  }
});


/**
 * GET /api/transcripts/:meetingId
 * Fetch all transcript entries for a meeting in chronological order.
 */
router.get('/:meetingId', authMiddleware, async (req, res) => {
  try {
    const { meetingId } = req.params;

    const entries = await Transcript.find({ meetingId })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({ success: true, data: entries });
  } catch (err) {
    console.error('❌ [Transcript] GET error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error fetching transcripts.' });
  }
});

module.exports = router;
