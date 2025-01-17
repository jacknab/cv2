const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const chalk = require('chalk');
const { initializeDatabase } = require('./database/database');
const UserModel = require('./database/models/user');
const WalletModel = require('./database/models/wallet');
const authenticateToken = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, host: '0.0.0.0' });

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT Secret
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-here';

// Game state variables
const clients = [];
let isGameActive = false;
let crashPoint = 0;
let gameInterval;

function initializeGameLogic(wss) {
    wss.on('connection', (ws) => {
        clients.push(ws);
        console.log(chalk.green('Client connected. Total clients:', clients.length));

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

        if (clients.length === 1 && !isGameActive) {
            startWaitingPeriod();
        }
    });
}

function generateCrashPoint() {
    return (Math.random() * 5 + 1).toFixed(2);
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

async function startServer() {
    try {
        console.log(chalk.yellow('Initializing database connection...'));
        const sequelize = await initializeDatabase();
        
        console.log(chalk.yellow('Setting up models...'));
        const User = UserModel(sequelize);
        const Wallet = WalletModel(sequelize);

        // Define relationships
        User.hasOne(Wallet);
        Wallet.belongsTo(User);

        await sequelize.sync();
        console.log(chalk.green('Database synchronized successfully'));

        // Store models in app.locals
        app.locals.models = { User, Wallet };

        // Start HTTP server
        server.listen(PORT, () => {
            console.log(chalk.green(`Server running on port ${PORT}`));
        });

        // Initialize WebSocket game
        initializeGameLogic(wss);

    } catch (error) {
        console.error(chalk.red('Server startup error:', error));
        process.exit(1);
    }
}

console.log(chalk.yellow('Starting server initialization...'));
startServer();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const { User, Wallet } = app.locals.models;

        console.log('Registration attempt for:', username); // Debug log

        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
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

        const token = jwt.sign(
            { userId: result.id, username: result.username },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        console.log('Registration successful for:', username); // Debug log

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

// Update login endpoint with better logging
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const { User } = app.locals.models;

        console.log(chalk.blue('Login attempt for:', username));

        const user = await User.findOne({ where: { username } });
        if (!user) {
            console.log(chalk.yellow('User not found:', username));
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log(chalk.yellow('Invalid password for:', username));
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        console.log(chalk.green('Login successful for:', username));

        res.json({ 
            message: 'Login successful',
            token,
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

// Add profile endpoint
app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const { User } = app.locals.models;
        const user = await User.findByPk(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Mount auth routes
app.use('/api/auth', authRoutes);
