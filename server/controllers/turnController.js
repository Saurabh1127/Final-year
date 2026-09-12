import turnService from '../services/turnService.js';

class TurnController {
  async getCredentials(req, res) {
    try {
      const credentials = await turnService.getCredentials();
      res.json(credentials);
    } catch (error) {
      console.error('❌ Error fetching TURN credentials:', error.message);
      res.status(error.status || 500).json({ message: error.message || 'Failed to fetch TURN credentials.' });
    }
  }
}

export default new TurnController();
