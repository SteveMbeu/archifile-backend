require('dotenv').config()
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const p = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

bcrypt.hash('Admin@archifile2025!', 12).then(hash => {
  p.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin@archifile.com'])
  .then(() => { console.log('✅ Mot de passe réinitialisé'); p.end() })
  .catch(e => { console.error(e.message); p.end() })
})