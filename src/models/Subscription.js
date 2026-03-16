const { DataTypes } = require('sequelize')

module.exports = (sequelize) => sequelize.define('Subscription', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:       { type: DataTypes.UUID, allowNull: false },
  plan:          { type: DataTypes.STRING, allowNull: false },
  frequence:     { type: DataTypes.STRING, allowNull: false },
  statut:        { type: DataTypes.STRING, defaultValue: 'active' },
  montant_ht:    { type: DataTypes.DECIMAL(12,2), allowNull: false },
  taux_taxe:     { type: DataTypes.DECIMAL(5,2), defaultValue: 18 },
  montant_taxe:  { type: DataTypes.DECIMAL(12,2), allowNull: false },
  remise_pct:    { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
  montant_total: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  devise:        { type: DataTypes.STRING(10), defaultValue: 'XAF' },
  starts_at:     { type: DataTypes.DATE },
  ends_at:       { type: DataTypes.DATE },
  cancelled_at:  { type: DataTypes.DATE },
  cancel_reason: { type: DataTypes.TEXT },
  auto_renew:    { type: DataTypes.BOOLEAN, defaultValue: true },
  notif_sent:    { type: DataTypes.JSONB, defaultValue: {} },
}, {
  tableName:  'subscriptions',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
})