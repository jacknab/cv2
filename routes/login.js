const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getSequelizeInstance } = require('../database/database');
const UserModel = require('../database/models/user');
require('dotenv').config(); // To load .env variables

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'your_default_secret_key'; // Use environment variable

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const sequelize = getSequelizeInstance();
        const User = UserModel(sequelize);

        // Check if user exists
        const user = await User.findOne({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Generate JWT token with a longer expiration (24 hours, for example)
        const token = jwt.sign({ userId: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });

        // Respond with token and user details
        res.json({
            message: 'Login successful.',
            token,
            userId: user.id,
            username: user.username
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed.' });
    }
});

module.exports = router;
