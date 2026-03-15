
const jwt  = require('jsonwebtoken')
const pool = require('../config/database')

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token manquant' })
    }
    const token   = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const result = await pool.query(
      'SELECT id, email, role, plan, is_verified FROM users WHERE id = $1',
      [decoded.id]
    )
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Utilisateur introuvable' })
    }
    req.user = result.rows[0]
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expiré', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ success: false, message: 'Token invalide' })
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs' })
  }
  next()
}

function requireVerified(req, res, next) {
  if (!req.user.is_verified) {
    return res.status(403).json({ success: false, message: 'Veuillez confirmer votre adresse email' })
  }
  next()
}

function generateTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role }
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  })
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  })
  return { accessToken, refreshToken }
}

module.exports = { authenticate, requireAdmin, requireVerified, generateTokens }