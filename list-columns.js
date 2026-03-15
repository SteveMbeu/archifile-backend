require('dotenv').config()
const { Pool } = require('pg')
const p = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})
const tables = ['users','documents','subscriptions','orders','notifications','demo_requests']
async function run() {
  for (const t of tables) {
    const r = await p.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]
    )
    console.log('\n=== ' + t.toUpperCase() + ' ===')
    r.rows.forEach(c => console.log(`  ${c.column_name} | ${c.data_type} | nullable:${c.is_nullable}`))
  }
  p.end()
}
run()