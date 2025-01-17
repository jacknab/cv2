const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authenticateToken = require('../middleware/auth');

router.get('/verify', authenticateToken, (req, res) => {
    try {
        res.json({ 
            verified: true, 
            username: req.user.username,
            userId: req.user.userId
        });
    } catch (error) {
        console.error('Auth verification error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
});

module.exports = router;