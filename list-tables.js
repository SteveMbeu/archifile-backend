require('dotenv').config()
const { Pool } = require('pg')
const p = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})
p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
.then(r => { r.rows.forEach(t => console.log(t.table_name)); p.end() })
.catch(e => { console.error(e.message); p.end() })