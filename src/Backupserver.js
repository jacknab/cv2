const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { initializeDatabase, getSequelizeInstance } = require('./database/database');
const UserModel = require('./database/models/user');
const TransactionModel = require('./database/models/transactions');
const WalletModel = require('./database/models/wallet');
const dotenv = require('dotenv'); // Required to load .env file

const chalk = require('chalk');

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.json());

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        // Redirect to login instead of sending error
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (error) {
        return res.redirect('/login');
    }
};

// Public routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Protected routes
app.get('/dashboard', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Error handling for static files
app.use((err, req, res, next) => {
    if (err.code === 'ENOENT') {
        res.redirect('/login');
    } else {
        res.status(500).send('Server Error');
    }
});

const registerRouter = require('./routes/register');

// Load environment variables from .env file
dotenv.config();

// Define JWT secret key
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-here';

let currentSpeed = 1; // Define currentSpeed correctly here

let models = {}; // Global models object

async function initializeModels() {
    try {
        const sequelize = await initializeDatabase();
        
        // Initialize models
        const User = UserModel(sequelize);
        const Wallet = WalletModel(sequelize);

        // Set up relationships
        User.hasOne(Wallet);
        Wallet.belongsTo(User);

        await sequelize.sync();

        // Store models globally
        models = { User, Wallet };
        app.locals.models = models;

        return { sequelize, models };
    } catch (error) {
        console.error('Model initialization error:', error);
        throw error;
    }
}

// Initialize models and database before routes
async function startServer() {
    try {
        // Initialize models before routes
        await initializeModels();

        // Routes setup after models are initialized
        const registerRouter = require('./routes/register');
        app.use('/register', registerRouter);

        // Profile route
        app.get('/profile', authenticateToken, async (req, res) => {
            try {
                const user = await models.User.findByPk(req.user.userId);
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }
                res.json({
                    message: 'Profile fetched successfully',
                    user: {
                        id: user.id,
                        username: user.username
                    }
                });
            } catch (error) {
                console.error(chalk.red('Profile error:', error));
                res.status(500).json({ error: 'Failed to fetch profile' });
            }
        });

        // WebSocket setup
        const clients = [];
        let isGameActive = false;
        let crashPoint = 0;
        let gameInterval;

        function generateCrashPoint() {
            return (Math.random() * 5 + 1).toFixed(2); // Between 1.0 and 6.0
        }

        function broadcast(data) {
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }

        function startWaitingPeriod() {
            let countdown = 8;
            broadcast({ event: 'waiting', countdown });

            const waitingInterval = setInterval(() => {
                countdown--;
                if (countdown === 0) {
                    clearInterval(waitingInterval);
                    startGame();
                } else {
                    broadcast({ event: 'waiting', countdown });
                }
            }, 1000);
        }

        function startGame() {
            if (isGameActive) return;
            
            crashPoint = generateCrashPoint();
            isGameActive = true;
            const startTime = Date.now();

            broadcast({ event: 'game_start' });

            gameInterval = setInterval(() => {
                const elapsedTime = (Date.now() - startTime) / 1000;
                const multiplier = 1.00 * Math.exp(elapsedTime / 10);

                if (multiplier >= crashPoint) {
                    clearInterval(gameInterval);
                    crashGame();
                } else {
                    broadcast({ 
                        event: 'progress', 
                        multiplier: multiplier.toFixed(2) 
                    });
                }
            }, 100);
        }

        function crashGame() {
            isGameActive = false;
            clearInterval(gameInterval);
            broadcast({ event: 'crash', multiplier: crashPoint });
            setTimeout(startWaitingPeriod, 2000);
        }

        // WebSocket connection handling
        wss.on('connection', (ws) => {
            clients.push(ws);
            console.log(chalk.green('Client connected. Total clients:', clients.length));

            // Send game state to new client
            ws.send(JSON.stringify({ 
                event: 'connected',
                gameActive: isGameActive,
                crashPoint: crashPoint
            }));

            ws.on('close', () => {
                const index = clients.indexOf(ws);
                if (index !== -1) {
                    clients.splice(index, 1);
                }
                console.log(chalk.yellow('Client disconnected. Total clients:', clients.length));
            });

            // Start game if this is the first client
            if (clients.length === 1 && !isGameActive) {
                startWaitingPeriod();
            }
        });

        // Start server
        server.listen(PORT, () => {
            console.log(chalk.green(`Server running on port ${PORT}`));
        });

    } catch (error) {
        console.error(chalk.red('Server startup error:', error));
        process.exit(1);
    }
}

startServer();

// Register route
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const { User, Wallet } = models;

        // Check if username exists
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Use transaction to ensure both records are created
        const result = await User.sequelize.transaction(async (t) => {
            // Create user
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await User.create({
                username,
                password: hashedPassword
            }, { transaction: t });

            // Create wallet
            await Wallet.create({
                userid: user.id,
                balance: 0.00
            }, { transaction: t });

            return user;
        });

        // Generate token
        const token = jwt.sign(
            { userId: result.id, username: result.username },
            SECRET_KEY,
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
        console.error(chalk.red('Registration error:', error));
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login route
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const sequelize = await getSequelizeInstance();
        const User = UserModel(sequelize);

        // Find user
        const user = await User.findOne({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token using SECRET_KEY
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.json({ 
            message: 'Login successful',
            token,
            redirectUrl: '/dashboard',
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error(chalk.red('Login error:', error));
        res.status(500).json({ error: 'Login failed' });
    }
});

// Profile route - Now authenticateToken is defined
app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const sequelize = await getSequelizeInstance();
        const User = UserModel(sequelize);
        
        const user = await User.findByPk(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Profile fetched successfully',
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error(chalk.red('Profile error:', error));
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});