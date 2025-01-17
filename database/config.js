const { Sequelize } = require('sequelize');
const config = require('./config');

async function initializeDatabase() {
    const sequelize = new Sequelize(
        config.database.mysql.database,
        config.database.mysql.user,
        config.database.mysql.password,
        {
            host: config.database.mysql.host,
            dialect: 'mysql',
            port: config.database.mysql.port,
            logging: console.log
        }
    );

    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');
        return sequelize;
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        throw error;
    }
}

module.exports = {
    database: {
        type: "mysql",
        mysql: {
            host: "localhost",
            port: 3306,
            user: "root",
            password: "1825Logan305!",
            database: "app_db"
        }
    }
};
