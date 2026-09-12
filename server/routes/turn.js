import express from 'express';
import authMiddleware from '../middleware/auth.js';
import turnController from '../controllers/turnController.js';

const router = express.Router();

router.get('/credentials', authMiddleware, turnController.getCredentials);

export default router;
