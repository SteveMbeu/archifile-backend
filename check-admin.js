require('dotenv').config()
const { Pool } = require('pg')

const p = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

p.query("SELECT email, role, plan, substring(password_hash,1,20) as pwd FROM users WHERE email = 'admin@archifile.com'")
.then(r => { console.log(r.rows); p.end() })
.catch(e => { console.error(e.message); p.end() })