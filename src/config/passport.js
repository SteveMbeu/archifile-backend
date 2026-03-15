// src/config/passport.js
const passport       = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const pool           = require('./database')
const { generateTokens } = require('../middlewares/auth')

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔵 Google profile reçu:', profile.id, profile.emails?.[0]?.value)

    const email  = profile.emails?.[0]?.value
    const prenom = profile.name?.givenName  || ''
    const nom    = profile.name?.familyName || ''

    if (!email) return done(new Error('Email Google non disponible'), null)

    // Chercher utilisateur existant
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    let user   = result.rows[0]

    if (user) {
      console.log('🔵 Utilisateur existant trouvé:', user.email)
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [profile.id, user.id])
        user.google_id = profile.id
      }
    } else {
      console.log('🔵 Création nouvel utilisateur Google:', email)
      const newUser = await pool.query(
        `INSERT INTO users (email, google_id, prenom, nom, is_verified, role, plan)
         VALUES ($1, $2, $3, $4, TRUE, 'user', 'freemium') RETURNING *`,
        [email, profile.id, prenom, nom]
      )
      user = newUser.rows[0]
    }

    // Générer tokens JWT
    const tokens = generateTokens(user)
    console.log('🔵 Tokens générés pour:', user.email)

    await pool.query(
      'UPDATE users SET refresh_token = $1, last_login_at = NOW() WHERE id = $2',
      [tokens.refreshToken, user.id]
    )

    return done(null, { user, tokens })
  } catch (err) {
    console.error('❌ Erreur passport Google:', err.message)
    return done(err, null)
  }
}))

module.exports = passport