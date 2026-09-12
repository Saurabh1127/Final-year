import summaryService from '../services/summaryService.js';

class SummaryController {
  async summarizeMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      const summary = await summaryService.generateSummary(meetingId);
      
      return res.json({
        success: true,
        data: summary,
      });
    } catch (err) {
      console.error('❌ [Summary] API error:', err.response?.data || err.message);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to generate meeting summary.',
        detail: err.response?.data?.error?.message || err.message,
      });
    }
  }

  async getSummary(req, res) {
    try {
      const { meetingId } = req.params;
      const summary = await summaryService.getSummary(meetingId);
      return res.json({ success: true, data: summary });
    } catch (err) {
      console.error('❌ [Summary] GET error:', err.message);
      return res.status(err.status || 500).json({ success: false, message: err.message || 'Server error fetching summary.' });
    }
  }
}

export default new SummaryController();
