const axios = require('axios');

class TurnService {
  async getCredentials() {
    const METERED_API_KEY = process.env.METERED_API_KEY;
    if (!METERED_API_KEY) {
      console.warn('⚠️ METERED_API_KEY is not set in environment.');
      const error = new Error('TURN server configuration is missing.');
      error.status = 500;
      throw error;
    }

    const response = await axios.get(
      `https://anujx.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );

    return response.data;
  }
}

module.exports = new TurnService();
