const express = require('express');
const bcrypt = require('bcrypt');
const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Validation middleware
const validateRegister = [
    check('username').notEmpty().trim(),
    check('password').isLength({ min: 6 })
];

router.post('/', validateRegister, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { username, password } = req.body;
        const { User, Wallet } = req.app.locals.models; // Get models from app.locals

        // Check for existing user
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user and wallet in transaction
        const result = await User.sequelize.transaction(async (t) => {
            const user = await User.create({
                username,
                password: hashedPassword
            }, { transaction: t });

            await Wallet.create({
                userid: user.id,
                balance: 0.00
            }, { transaction: t });

            return user;
        });

        // Generate JWT token
        const token = jwt.sign(
            { userId: result.id, username: result.username },
            process.env.JWT_SECRET || 'your-secret-key-here',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: result.id,
                username: result.username
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

module.exports = router;
