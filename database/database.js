console.log('Looking for config.js at:', require.resolve('./config')); // Ensure config.js is resolved correctly
const { Sequelize } = require('sequelize');
const chalk = require('chalk');
const config = require('./config');

let sequelize; // Declare sequelize globally for initialization later

async function initializeDatabase() {
    try {
        switch (config.database.type) {
            case 'sqlite':
                console.log(chalk.green('Using SQLite as the database.'));
                sequelize = new Sequelize({
                    dialect: 'sqlite',
                    storage: config.database.sqlite.path
                });
                break;
            case 'mysql':
                console.log(chalk.green('Attempting to use MySQL as the database.'));
                sequelize = new Sequelize(
                    config.database.mysql.database,
                    config.database.mysql.user,
                    config.database.mysql.password,
                    {
                        host: config.database.mysql.host,
                        dialect: 'mysql',
                        port: config.database.mysql.port
                    }
                );
                break;
            case 'postgresql':
                console.log(chalk.green('Attempting to use PostgreSQL as the database.'));
                sequelize = new Sequelize(
                    config.database.postgresql.database,
                    config.database.postgresql.user,
                    config.database.postgresql.password,
                    {
                        host: config.database.postgresql.host,
                        dialect: 'postgres',
                        port: config.database.postgresql.port
                    }
                );
                break;
            default:
                throw new Error('Invalid database type specified in config.');
        }

        // Authenticate sequelize
        await sequelize.authenticate();
        console.log(chalk.green('Database connection established successfully.'));

        // Conditional model synchronization
        if (process.env.NODE_ENV !== 'production') {
            console.log(chalk.yellow('Running sequelize.sync() in development mode...'));
            await sequelize.sync({ alter: true }); // Sync schema in non-production environments
            console.log(chalk.green('Models synchronized successfully.'));
        } else {
            console.log(chalk.blue('Skipping sequelize.sync() in production mode.'));
        }

        return sequelize; // Return the initialized sequelize instance
    } catch (error) {
        console.error(chalk.red('Failed to connect to the database:', error));
        process.exit(1); // Exit if database connection fails
    }
}

// Function to verify the sequelize instance (for debugging purposes)
function getSequelizeInstance() {
    if (!sequelize) {
        throw new Error('Sequelize instance is not initialized. Call initializeDatabase first.');
    }
    return sequelize;
}

module.exports = { initializeDatabase, getSequelizeInstance };
