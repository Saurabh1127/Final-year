const express = require('express');
const authMiddleware = require('../middleware/auth');
const turnController = require('../controllers/turnController');

const router = express.Router();

router.get('/credentials', authMiddleware, turnController.getCredentials);

module.exports = router;
