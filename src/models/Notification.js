const { DataTypes } = require('sequelize')

module.exports = (sequelize) => sequelize.define('Notification', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:    { type: DataTypes.UUID, allowNull: false },
  type:       { type: DataTypes.STRING, allowNull: false },
  titre:      { type: DataTypes.STRING, allowNull: false },
  message:    { type: DataTypes.TEXT, allowNull: false },
  canal:      { type: DataTypes.STRING, defaultValue: 'app' },
  est_lu:     { type: DataTypes.BOOLEAN, defaultValue: false },
  envoye:     { type: DataTypes.BOOLEAN, defaultValue: false },
  envoye_at:  { type: DataTypes.DATE },
  metadata:   { type: DataTypes.JSONB, defaultValue: {} },
}, {
  tableName:  'notifications',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
})