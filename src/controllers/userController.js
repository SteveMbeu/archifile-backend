
const bcrypt = require('bcryptjs')
const pool   = require('../config/database')
const { encrypt, decrypt, masque } = require('../utils/crypto')

async function updateProfile(req, res) {
  try {
    const { titre, prenom, nom, telephone, pays, adresse_facturation, preferences } = req.body
    const telChiffre = telephone ? encrypt(telephone) : undefined
    const fields = [], values = []
    let idx = 1
    if (titre !== undefined)               { fields.push(`titre = $${idx++}`);               values.push(titre) }
    if (prenom !== undefined)              { fields.push(`prenom = $${idx++}`);              values.push(prenom) }
    if (nom !== undefined)                 { fields.push(`nom = $${idx++}`);                 values.push(nom) }
    if (telChiffre !== undefined)          { fields.push(`telephone = $${idx++}`);           values.push(telChiffre) }
    if (pays !== undefined)                { fields.push(`pays = $${idx++}`);                values.push(pays) }
    if (adresse_facturation !== undefined) { fields.push(`adresse_facturation = $${idx++}`); values.push(adresse_facturation) }
    if (preferences !== undefined)         { fields.push(`preferences = $${idx++}`);         values.push(JSON.stringify(preferences)) }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Aucune donnée à mettre à jour' })
    values.push(req.user.id)
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values)
    res.json({ success: true, message: 'Profil mis à jour' })
  } catch (err) {
    console.error('updateProfile error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body
    if (!current_password || !new_password) return res.status(400).json({ success: false, message: 'Ancien et nouveau mot de passe requis' })
    if (new_password.length < 8) return res.status(400).json({ success: false, message: 'Mot de passe : 8 caractères minimum' })
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
    const valid  = await bcrypt.compare(current_password, result.rows[0].password_hash)
    if (!valid) return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect' })
    const hash = await bcrypt.hash(new_password, 12)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id])
    res.json({ success: true, message: 'Mot de passe modifié avec succès' })
  } catch (err) {
    console.error('changePassword error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function deleteAccount(req, res) {
  try {
    const { password } = req.body
    if (!password) return res.status(400).json({ success: false, message: 'Mot de passe requis' })
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
    const valid  = await bcrypt.compare(password, result.rows[0].password_hash)
    if (!valid) return res.status(401).json({ success: false, message: 'Mot de passe incorrect' })
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id])
    res.json({ success: true, message: 'Compte supprimé définitivement' })
  } catch (err) {
    console.error('deleteAccount error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function getAllUsers(req, res) {
  try {
    const { search, plan, role, page = 1, limit = 20 } = req.query
    const offset = (page - 1) * limit
    const conditions = [], values = []
    let idx = 1
    if (search) { conditions.push(`(email ILIKE $${idx} OR prenom ILIKE $${idx} OR nom ILIKE $${idx})`); values.push(`%${search}%`); idx++ }
    if (plan)   { conditions.push(`plan = $${idx++}`);  values.push(plan) }
    if (role)   { conditions.push(`role = $${idx++}`);  values.push(role) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [countResult, usersResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users ${where}`, values),
      pool.query(`SELECT id, email, titre, prenom, nom, role, plan, is_verified, last_login_at, freemium_expires_at, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...values, limit, offset]),
    ])
    res.json({ success: true, data: { users: usersResult.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) } })
  } catch (err) {
    console.error('getAllUsers error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function getUserById(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.*, (SELECT COUNT(*) FROM documents WHERE user_id = u.id) AS nb_documents,
              (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS nb_orders
       FROM users u WHERE u.id = $1`, [req.params.id]
    )
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
    const user = result.rows[0]
    delete user.password_hash; delete user.refresh_token; delete user.verify_token; delete user.reset_token
    if (user.telephone) user.telephone = masque(decrypt(user.telephone))
    res.json({ success: true, data: user })
  } catch (err) {
    console.error('getUserById error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function updateUser(req, res) {
  try {
    const { role, plan, is_verified } = req.body
    const fields = [], values = []
    let idx = 1
    if (role !== undefined)        { fields.push(`role = $${idx++}`);        values.push(role) }
    if (plan !== undefined)        { fields.push(`plan = $${idx++}`);        values.push(plan) }
    if (is_verified !== undefined) { fields.push(`is_verified = $${idx++}`); values.push(is_verified) }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Aucune donnée à modifier' })
    values.push(req.params.id)
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values)
    res.json({ success: true, message: 'Utilisateur mis à jour' })
  } catch (err) {
    console.error('updateUser error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function deleteUser(req, res) {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ success: false, message: 'Impossible de supprimer votre propre compte' })
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    res.json({ success: true, message: 'Utilisateur supprimé' })
  } catch (err) {
    console.error('deleteUser error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function getAdminStats(req, res) {
  try {
    const [users, subs, orders, docs] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_verified) AS verified, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_30d, COUNT(*) FILTER (WHERE plan = 'freemium') AS freemium, COUNT(*) FILTER (WHERE plan = 'starter') AS starter, COUNT(*) FILTER (WHERE plan = 'pro') AS pro, COUNT(*) FILTER (WHERE plan = 'enterprise') AS enterprise FROM users WHERE role = 'user'`),
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE statut = 'actif') AS actifs, SUM(montant_total) FILTER (WHERE statut = 'actif') AS mrr FROM subscriptions`),
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE statut = 'traite') AS traites, SUM(montant_total) FILTER (WHERE statut = 'traite') AS revenue_total FROM orders`),
      pool.query(`SELECT COUNT(*) AS total FROM documents`),
    ])
    res.json({ success: true, data: { users: users.rows[0], subscriptions: subs.rows[0], orders: orders.rows[0], documents: docs.rows[0] } })
  } catch (err) {
    console.error('getAdminStats error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

module.exports = { updateProfile, changePassword, deleteAccount, getAllUsers, getUserById, updateUser, deleteUser, getAdminStats }