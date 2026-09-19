import meetingService from '../services/meetingService.js';

class MeetingController {
  async createMeeting(req, res) {
    try {
      const { title } = req.body;
      const result = await meetingService.createMeeting({
        title,
        hostId: req.userId,
        hostName: req.user.name,
        hostLanguage: req.user.preferredLanguage
      });
      res.status(201).json(result);
    } catch (error) {
      console.error('Create meeting error:', error);
      res.status(error.status || 500).json({ message: error.message || 'Failed to create meeting.' });
    }
  }

  async getMeeting(req, res) {
    try {
      const result = await meetingService.getMeeting(req.params.roomCode);
      res.json(result);
    } catch (error) {
      console.error('Get meeting error:', error);
      res.status(error.status || 500).json({ message: error.message || 'Failed to fetch meeting.' });
    }
  }

  async updateLanguage(req, res) {
    try {
      const { targetLanguage } = req.body;
      if (!targetLanguage) {
        return res.status(400).json({ message: 'targetLanguage is required.' });
      }

      await meetingService.updateLanguage(req.params.roomCode, req.userId, targetLanguage);
      res.json({ message: 'Language updated.', targetLanguage });
    } catch (error) {
      console.error('Update language error:', error);
      res.status(error.status || 500).json({ message: error.message || 'Failed to update language.' });
    }
  }

  async endMeeting(req, res) {
    try {
      const result = await meetingService.endMeeting({
        roomCode: req.params.roomCode,
        hostId: req.userId,
      });
      res.json({ message: 'Meeting ended successfully.', meeting: result });
    } catch (error) {
      console.error('End meeting error:', error);
      res.status(error.status || 500).json({ message: error.message || 'Failed to end meeting.' });
    }
  }
}


export default new MeetingController();
