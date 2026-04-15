const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../../middleware/jwtMiddleware');

router.post('/login', authController.login);
// Local Dev Guest Login
router.get('/guest-login', authController.guestLogin);
router.get('/me', verifyToken, authController.getCurrentUser);
router.post('/refresh', authController.refreshAccessToken);
// routes/authRoutes.js
router.put('/reset-password', verifyToken, authController.resetPassword);
module.exports = router;