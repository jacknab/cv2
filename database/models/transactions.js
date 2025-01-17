const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Transaction', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        userid: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'pending'
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE
    });
};
