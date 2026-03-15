
require('dotenv').config()
const pool    = require('./database')
const bcrypt  = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

async function seed() {
  console.log('🌱 Démarrage du seed...\n')
  const client = await pool.connect()
  try {
    // Admin
    const adminEmail = 'admin@archifile.com'
    const existing   = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail])

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('Admin@archifile2025!', 12)
      await client.query(
        `INSERT INTO users (id, email, password_hash, prenom, nom, role, plan, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), adminEmail, hash, 'Admin', 'Archifile', 'admin', 'enterprise', true]
      )
      console.log('  ✅ Admin créé : admin@archifile.com / Admin@archifile2025!')
    } else {
      console.log('  ℹ️  Admin déjà existant')
    }

    // Utilisateur test
    const testEmail = 'test@archifile.com'
    const existingTest = await client.query('SELECT id FROM users WHERE email = $1', [testEmail])

    if (existingTest.rows.length === 0) {
      const hash = await bcrypt.hash('Test@1234', 12)
      await client.query(
        `INSERT INTO users (id, email, password_hash, prenom, nom, role, plan, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), testEmail, hash, 'Utilisateur', 'Test', 'user', 'freemium', true]
      )
      console.log('  ✅ Test créé : test@archifile.com / Test@1234')
    } else {
      console.log('  ℹ️  Utilisateur test déjà existant')
    }

    console.log('\n✅ Seed terminé !')
  } catch (err) {
    console.error('\n❌ Erreur seed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    pool.end()
  }
}

seed()