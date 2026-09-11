const turnService = require('../services/turnService');

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

module.exports = new TurnController();
