const mongoose = require('mongoose');

const transcriptSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    index: true,
  },
  speakerId: {
    type: String,
    required: true,
  },
  speakerName: {
    type: String,
    required: true,
    default: 'Anonymous',
  },
  sourceLanguage: {
    type: String,
    default: 'auto',
  },
  originalText: {
    type: String,
    required: true,
  },
  translations: {
    type: Map,
    of: String,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient meeting transcript retrieval
transcriptSchema.index({ meetingId: 1, timestamp: 1 });

module.exports = mongoose.model('Transcript', transcriptSchema);
