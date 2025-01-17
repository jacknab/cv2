const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        tableName: 'Users',
        timestamps: true, // Automatically adds 'createdAt' and 'updatedAt' columns
        underscored: true, // Maps column names to snake_case (e.g., created_at, updated_at)
    });
};
