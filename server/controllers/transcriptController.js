const transcriptService = require('../services/transcriptService');

class TranscriptController {
  async createTranscript(req, res) {
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

      if (originalText.length > 5000) {
        return res.status(400).json({
          success: false,
          message: 'originalText exceeds maximum length of 5000 characters.',
        });
      }

      if (speakerName && speakerName.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'speakerName exceeds maximum length of 50 characters.',
        });
      }

      const io = req.app.get('io');
      const entry = await transcriptService.saveTranscript({
        meetingId,
        speakerId,
        speakerName,
        sourceLanguage,
        originalText,
        translations
      }, io);

      return res.status(201).json({ success: true, data: entry });
    } catch (err) {
      console.error('❌ [Transcript] POST error:', err.message);
      return res.status(500).json({ success: false, message: 'Server error saving transcript.' });
    }
  }

  async getTranscripts(req, res) {
    try {
      const { meetingId } = req.params;
      const entries = await transcriptService.getTranscripts(meetingId);
      return res.json({ success: true, data: entries });
    } catch (err) {
      console.error('❌ [Transcript] GET error:', err.message);
      return res.status(500).json({ success: false, message: 'Server error fetching transcripts.' });
    }
  }
}

module.exports = new TranscriptController();
