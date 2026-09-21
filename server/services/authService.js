import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

class AuthService {
  async register({ name, email, password }) {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const error = new Error('An account with this email already exists.');
      error.status = 409;
      throw error;
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferredLanguage: user.preferredLanguage,
      },
    };
  }

  async login({ email, password }) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.status = 401;
      throw error;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.status = 401;
      throw error;
    }

    const token = generateToken(user._id);

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        preferredLanguage: user.preferredLanguage,
      },
    };
  }

  async googleAuth({ credential, accessToken }) {
    if (!credential && !accessToken) {
      const error = new Error('Google credential or access token is required.');
      error.status = 400;
      throw error;
    }

    let payload;

    if (accessToken) {
      try {
        const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        payload = userInfoRes.data;
      } catch (err) {
        console.error('Google userInfo fetch failed:', err.message);
        const error = new Error('Invalid or expired Google access token.');
        error.status = 401;
        throw error;
      }
    } else {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const client = new OAuth2Client(clientId);

      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: clientId,
        });
        payload = ticket.getPayload();
      } catch (err) {
        console.error('Google token verification failed:', err.message);
        const error = new Error('Invalid or expired Google credential.');
        error.status = 401;
        throw error;
      }
    }

    const googleId = payload.sub || payload.id;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    if (!email) {
      const error = new Error('No email found in Google account.');
      error.status = 400;
      throw error;
    }

    const normalizedEmail = email.toLowerCase();

    // Find existing user by googleId or email
    let user = await User.findOne({
      $or: [{ googleId }, { email: normalizedEmail }],
    });

    if (user) {
      let modified = false;
      if (!user.googleId) {
        user.googleId = googleId;
        modified = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    } else {
      user = await User.create({
        name: name || 'Google User',
        email: normalizedEmail,
        googleId,
        avatar: picture || null,
        authProvider: 'google',
      });
    }

    const token = generateToken(user._id);

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        authProvider: user.authProvider,
        preferredLanguage: user.preferredLanguage,
      },
    };
  }
}

export default new AuthService();
