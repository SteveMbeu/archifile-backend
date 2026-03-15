// src/models/Document.js
const { DataTypes } = require('sequelize')

module.exports = (sequelize) => sequelize.define('Document', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:      { type: DataTypes.UUID, allowNull: false },
  nom_original: { type: DataTypes.STRING, allowNull: false },
  nom_stockage: { type: DataTypes.STRING, allowNull: false },
  type_mime:    { type: DataTypes.STRING },
  extension:    { type: DataTypes.STRING },
  taille_bytes: { type: DataTypes.BIGINT },
  dossier:      { type: DataTypes.STRING, defaultValue: 'Mes documents' },
  est_favori:   { type: DataTypes.BOOLEAN, defaultValue: false },
  est_archive:  { type: DataTypes.BOOLEAN, defaultValue: false },
  pages:        { type: DataTypes.INTEGER },
  description:  { type: DataTypes.TEXT },
  tags:         { type: DataTypes.JSONB, defaultValue: [] },
}, {
  tableName:  'documents',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
})