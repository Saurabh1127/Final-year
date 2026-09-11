const authService = require('../services/authService');

class AuthController {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
      }

      const result = await authService.register({ name, email, password });
      res.status(201).json(result);
    } catch (error) {
      console.error('Register error:', error);
      if (error.code === 11000 || error.status === 409) {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }
      res.status(error.status || 500).json({ message: error.message || 'Server error during registration.' });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const result = await authService.login({ email, password });
      res.json(result);
    } catch (error) {
      console.error('Login error:', error);
      res.status(error.status || 500).json({ message: error.message || 'Server error during login.' });
    }
  }

  async getMe(req, res) {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        preferredLanguage: req.user.preferredLanguage,
      },
    });
  }
}

module.exports = new AuthController();
