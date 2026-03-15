// src/index.js
require('dotenv').config()
const express     = require('express')
const cors        = require('cors')
const helmet      = require('helmet')
const compression = require('compression')
const rateLimit   = require('express-rate-limit')
const path        = require('path')
const passport    = require('./config/passport')
const routes      = require('./routes')
const { startCronJobs } = require('./services/cronService')

const app  = express()
const PORT = process.env.PORT || 5000

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(compression())
app.use(passport.initialize())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_PATH || './uploads')))

// ── Routes Google OAuth SANS rate limit ──────────────────
app.use('/api/auth/google', routes)

// ── Rate limiting pour les autres routes ─────────────────
app.use('/api/auth/login',           rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Trop de tentatives.' } }))
app.use('/api/auth/register',        rateLimit({ windowMs: 60 * 60 * 1000, max: 5,  message: { success: false, message: "Trop d'inscriptions." } }))
app.use('/api/auth/forgot-password', rateLimit({ windowMs: 60 * 60 * 1000, max: 5,  message: { success: false, message: 'Trop de demandes.' } }))
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { success: false, message: 'Trop de requêtes.' } }))

app.use('/api', routes)

app.get('/', (_req, res) => res.json({ message: '🗂 Archifile API — Techno Méga Partners', version: '1.0.0' }))
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route introuvable' }))
app.use((err, _req, res, _next) => { console.error('❌ Erreur:', err.message); res.status(500).json({ success: false, message: 'Erreur interne' }) })

app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(50))
  console.log(`  🗂  Archifile API`)
  console.log(`  🌍  http://localhost:${PORT}`)
  console.log(`  🌱  ${process.env.NODE_ENV || 'development'}`)
  console.log('═'.repeat(50) + '\n')
  startCronJobs()
})

module.exports = app