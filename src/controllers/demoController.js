
const pool         = require('../config/database')
const emailService = require('../services/emailService')

async function createDemoRequest(req, res) {
  try {
    const { nom, prenom, email, telephone, entreprise, type_entreprise, secteur, taille_entreprise, objectifs, defis, nb_utilisateurs, date_preferee, heure_preferee, langue, plateforme_visio } = req.body
    if (!nom || !prenom || !email) return res.status(400).json({ success: false, message: 'Nom, prénom et email requis' })
    const result = await pool.query(
      `INSERT INTO demo_requests (nom, prenom, email, telephone, entreprise, type_entreprise, secteur, taille_entreprise, objectifs, defis, nb_utilisateurs, date_preferee, heure_preferee, langue, plateforme_visio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [nom, prenom, email, telephone || null, entreprise || null, type_entreprise || null, secteur || null, taille_entreprise || null, objectifs || null, defis || null, nb_utilisateurs || null, date_preferee || null, heure_preferee || null, langue || 'fr', plateforme_visio || null]
    )
    await emailService.sendDemoRequestConfirmationEmail(result.rows[0])
    res.status(201).json({ success: true, message: 'Demande envoyée. Nous vous contacterons sous 48h.', data: { id: result.rows[0].id } })
  } catch (err) {
    console.error('createDemoRequest error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function getAllDemoRequests(req, res) {
  try {
    const { statut, page = 1, limit = 20 } = req.query
    const offset = (page - 1) * limit
    const conditions = [], values = []
    let idx = 1
    if (statut) { conditions.push(`statut = $${idx++}`); values.push(statut) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [countResult, demosResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM demo_requests ${where}`, values),
      pool.query(`SELECT * FROM demo_requests ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...values, limit, offset]),
    ])
    res.json({ success: true, data: { demos: demosResult.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) } })
  } catch (err) {
    console.error('getAllDemoRequests error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function updateDemoStatus(req, res) {
  try {
    const { statut, commentaires } = req.body
    const valid = ['en_attente', 'confirmee', 'realisee', 'annulee', 'reportee']
    if (!valid.includes(statut)) return res.status(400).json({ success: false, message: 'Statut invalide' })
    await pool.query('UPDATE demo_requests SET statut = $1, commentaires = $2 WHERE id = $3', [statut, commentaires || null, req.params.id])
    res.json({ success: true, message: 'Statut mis à jour' })
  } catch (err) {
    console.error('updateDemoStatus error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

module.exports = { createDemoRequest, getAllDemoRequests, updateDemoStatus }