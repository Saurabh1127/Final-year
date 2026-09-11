const Transcript = require('../models/Transcript');

class TranscriptService {
  async saveTranscript({ meetingId, speakerId, speakerName, sourceLanguage, originalText, translations }, io) {
    const entry = await Transcript.create({
      meetingId,
      speakerId,
      speakerName: speakerName || 'Anonymous',
      sourceLanguage: sourceLanguage || 'auto',
      originalText,
      translations: translations || {},
    });

    // Broadcast to all participants in this meeting room via Socket.IO
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

    return entry;
  }

  async getTranscripts(meetingId) {
    const entries = await Transcript.find({ meetingId })
      .sort({ timestamp: 1 })
      .lean();
    
    return entries;
  }
}

module.exports = new TranscriptService();
