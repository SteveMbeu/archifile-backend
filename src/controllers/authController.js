
const bcrypt  = require('bcryptjs')
const crypto  = require('crypto')
const pool    = require('../config/database')
const { generateTokens } = require('../middlewares/auth')
const emailService = require('../services/emailService')

async function register(req, res) {
  try {
    const { email, password, prenom, nom } = req.body
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email et mot de passe obligatoires' })
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Mot de passe : 8 caractères minimum' })

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length)
      return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' })

    const password_hash        = await bcrypt.hash(password, 12)
    const verify_token         = crypto.randomBytes(32).toString('hex')
    const verify_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, prenom, nom, verify_token, verify_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, prenom, nom, role, plan`,
      [email.toLowerCase(), password_hash, prenom || null, nom || null, verify_token, verify_token_expires]
    )
    await emailService.sendVerificationEmail(result.rows[0], verify_token)
    res.status(201).json({ success: true, message: 'Compte créé. Vérifiez votre email.', data: { id: result.rows[0].id, email: result.rows[0].email } })
  } catch (err) {
    console.error('register error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function verifyEmail(req, res) {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ success: false, message: 'Token manquant' })
    const result = await pool.query(
      `SELECT id, email, prenom, is_verified FROM users WHERE verify_token = $1 AND verify_token_expires > NOW()`,
      [token]
    )
    if (!result.rows.length)
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré' })
    const user = result.rows[0]
    if (user.is_verified) return res.json({ success: true, message: 'Email déjà vérifié' })
    await pool.query(`UPDATE users SET is_verified = TRUE, verify_token = NULL, verify_token_expires = NULL WHERE id = $1`, [user.id])
    await emailService.sendWelcomeEmail(user)
    res.json({ success: true, message: 'Email confirmé ! Vous pouvez vous connecter.' })
  } catch (err) {
    console.error('verifyEmail error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' })
    const result = await pool.query(
      `SELECT id, email, password_hash, prenom, nom, role, plan, is_verified, freemium_expires_at, login_history FROM users WHERE email = $1`,
      [email.toLowerCase()]
    )
    if (!result.rows.length)
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' })
    const user  = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid)
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' })

    const { accessToken, refreshToken } = generateTokens(user)
    const history = Array.isArray(user.login_history) ? user.login_history : []
    history.unshift({ date: new Date().toISOString(), ip: req.ip })
    if (history.length > 10) history.pop()
    await pool.query(
      `UPDATE users SET refresh_token = $1, last_login_at = NOW(), login_history = $2 WHERE id = $3`,
      [refreshToken, JSON.stringify(history), user.id]
    )
    res.json({
      success: true,
      data: {
        accessToken, refreshToken,
        user: { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom, role: user.role, plan: user.plan, is_verified: user.is_verified, freemium_expires_at: user.freemium_expires_at },
      },
    })
  } catch (err) {
    console.error('login error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token manquant' })
    const jwt = require('jsonwebtoken')
    let decoded
    try { decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET) }
    catch { return res.status(401).json({ success: false, message: 'Refresh token invalide ou expiré' }) }
    const result = await pool.query(`SELECT id, email, role, plan, refresh_token FROM users WHERE id = $1`, [decoded.id])
    const user = result.rows[0]
    if (!user || user.refresh_token !== refreshToken)
      return res.status(401).json({ success: false, message: 'Refresh token révoqué' })
    const tokens = generateTokens(user)
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [tokens.refreshToken, user.id])
    res.json({ success: true, data: tokens })
  } catch (err) {
    console.error('refreshToken error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function logout(req, res) {
  try {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id])
    res.json({ success: true, message: 'Déconnecté avec succès' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' })
    const result = await pool.query('SELECT id, email, prenom FROM users WHERE email = $1', [email.toLowerCase()])
    if (!result.rows.length) return res.json({ success: true, message: 'Si cet email existe, un lien vous a été envoyé.' })
    const user    = result.rows[0]
    const token   = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 60 * 60 * 1000)
    await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [token, expires, user.id])
    await emailService.sendResetPasswordEmail(user, token)
    res.json({ success: true, message: 'Si cet email existe, un lien vous a été envoyé.' })
  } catch (err) {
    console.error('forgotPassword error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token et mot de passe requis' })
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Mot de passe : 8 caractères minimum' })
    const result = await pool.query(`SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`, [token])
    if (!result.rows.length) return res.status(400).json({ success: false, message: 'Lien invalide ou expiré' })
    const hash = await bcrypt.hash(password, 12)
    await pool.query(`UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, refresh_token = NULL WHERE id = $2`, [hash, result.rows[0].id])
    res.json({ success: true, message: 'Mot de passe mis à jour avec succès' })
  } catch (err) {
    console.error('resetPassword error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, email, titre, prenom, nom, pays, adresse_facturation, role, plan, is_verified,
              freemium_starts_at, freemium_expires_at, last_login_at, preferences, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    )
    const user = result.rows[0]
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
    const { decrypt, masque } = require('../utils/crypto')
    const tel = user.telephone ? masque(decrypt(user.telephone)) : null
    res.json({ success: true, data: { ...user, telephone: tel } })
  } catch (err) {
    console.error('getMe error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

module.exports = { register, verifyEmail, login, refreshToken, logout, forgotPassword, resetPassword, getMe }