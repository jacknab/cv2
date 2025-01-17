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

// Move static middleware to top, before routes
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.json());

// Add static file error handling
app.use((err, req, res, next) => {
    if (err.code === 'ENOENT') {
        console.error(chalk.red(`File not found: ${req.path}`));
        res.status(404).json({ error: 'File not found' });
    } else {
        console.error(chalk.red('Static file error:', err));
        res.status(500).json({ error: 'Error serving static file' });
    }
});

const registerRouter = require('./routes/register');

// Load environment variables from .env file
dotenv.config();

// Define JWT secret key
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-here';

// Authentication middleware - Move before routes
const authenticateToken = require('./middleware/auth');

// Serve static files from the 'public' directory for logged-in users' content
app.use(express.static(path.join(__dirname, 'public')));

// Serve login, register, and index pages from the root directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

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

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);

                    if (data.event === 'placeBet') {
                        const { userId, betAmount, autoCashOut } = data;

                        // Validate inputs
                        if (!userId || !betAmount || betAmount <= 0) {
                            ws.send(JSON.stringify({ event: 'error', message: 'Invalid bet data' }));
                            return;
                        }

                        console.log(chalk.blue(`Bet received from user ${userId}: Amount - ${betAmount}, AutoCashOut - ${autoCashOut}`));

                        // Placeholder for actual bet handling logic
                        // e.g., deduct funds, save bet, etc.
                    }
                } catch (err) {
                    console.error(chalk.red('Error handling message:', err));
                    ws.send(JSON.stringify({ event: 'error', message: 'Invalid message format' }));
                }
            });

            ws.on('close', () => {
                const index = clients.indexOf(ws);
                if (index !== -1) {
                    clients.splice(index, 1);
                }
                console.log(chalk.yellow('Client disconnected. Total clients:', clients.length));
            });
        });

        server.listen(PORT, () => {
            console.log(chalk.green(`Server is running on port ${PORT}`));
        });
    } catch (error) {
        console.error('Server initialization error:', error);
    }
}

startServer();
