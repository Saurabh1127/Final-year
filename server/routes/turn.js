import express from 'express';
import turnController from '../controllers/turnController.js';

const router = express.Router();

// Allow all participants (authenticated or joining with room link) to get TURN credentials
router.get('/credentials', turnController.getCredentials);

export default router;

