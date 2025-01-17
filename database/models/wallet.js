const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Wallet', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        userid: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        balance: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.0
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE
    });
};
