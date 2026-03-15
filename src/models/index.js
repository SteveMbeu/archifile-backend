// src/models/index.js
const { Sequelize } = require('sequelize')

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host:    process.env.DB_HOST,
    port:    process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      timestamps:  true,
      underscored: true,
      createdAt:   'created_at',
      updatedAt:   'updated_at',
    },
  }
)

const User         = require('./User')(sequelize)
const Document     = require('./Document')(sequelize)
const Subscription = require('./Subscription')(sequelize)
const Order        = require('./Order')(sequelize)
const Notification = require('./Notification')(sequelize)
const DemoRequest  = require('./DemoRequest')(sequelize)

// ── ASSOCIATIONS ─────────────────────────────────────────
User.hasMany(Document,     { foreignKey: 'user_id', as: 'documents'     })
User.hasMany(Subscription, { foreignKey: 'user_id', as: 'subscriptions' })
User.hasMany(Order,        { foreignKey: 'user_id', as: 'orders'        })
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' })

Document.belongsTo(User,     { foreignKey: 'user_id', as: 'user' })
Subscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
Order.belongsTo(User,        { foreignKey: 'user_id', as: 'user' })
Order.belongsTo(Subscription,{ foreignKey: 'subscription_id', as: 'subscription' })
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

module.exports = { sequelize, User, Document, Subscription, Order, Notification, DemoRequest }