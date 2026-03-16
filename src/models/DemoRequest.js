
const { DataTypes } = require('sequelize')

module.exports = (sequelize) => sequelize.define('DemoRequest', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nom:               { type: DataTypes.STRING, allowNull: false },
  prenom:            { type: DataTypes.STRING, allowNull: false },
  email:             { type: DataTypes.STRING, allowNull: false },
  telephone:         { type: DataTypes.STRING },
  entreprise:        { type: DataTypes.STRING },
  type_entreprise:   { type: DataTypes.STRING },
  secteur:           { type: DataTypes.STRING },
  taille_entreprise: { type: DataTypes.STRING },
  objectifs:         { type: DataTypes.TEXT },
  defis:             { type: DataTypes.TEXT },
  nb_utilisateurs:   { type: DataTypes.STRING },
  date_preferee:     { type: DataTypes.DATEONLY },
  heure_preferee:    { type: DataTypes.TIME },
  langue:            { type: DataTypes.STRING, defaultValue: 'fr' },
  plateforme_visio:  { type: DataTypes.STRING },
  statut:            { type: DataTypes.STRING, defaultValue: 'nouveau' },
  commentaires:      { type: DataTypes.TEXT },
}, {
  tableName:  'demo_requests',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
})