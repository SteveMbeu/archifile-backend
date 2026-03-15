
const cron         = require('node-cron')
const pool         = require('../config/database')
const emailService = require('./emailService')

const NOTIF_RULES = {
  mensuel:     [7, 1, 0],
  trimestriel: [14, 7, 1, 0],
  annuel:      [30, 14, 7, 1, 0],
  '2ans':      [30, 14, 7, 1, 0],
}

async function checkRenewalNotifications() {
  console.log('🔔 [CRON] Vérification renouvellements...')
  try {
    const result = await pool.query(`
      SELECT s.*, u.email, u.prenom FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.statut = 'actif' AND s.ends_at IS NOT NULL`)
    for (const sub of result.rows) {
      const rules         = NOTIF_RULES[sub.frequence] || NOTIF_RULES.mensuel
      const notifSent     = Array.isArray(sub.notif_sent) ? sub.notif_sent : []
      const joursRestants = Math.ceil((new Date(sub.ends_at) - new Date()) / (1000 * 60 * 60 * 24))
      for (const joursAvant of rules) {
        const key = `renew_${sub.id}_j${joursAvant}`
        if (notifSent.includes(key)) continue
        if (joursRestants <= joursAvant && joursRestants >= joursAvant - 1) {
          await emailService.sendRenewalReminderEmail({ email: sub.email, prenom: sub.prenom }, sub, joursRestants)
          await pool.query(`INSERT INTO notifications (user_id, type, titre, message, canal, envoye, envoye_at) VALUES ($1,'renouvellement',$2,$3,'email',TRUE,NOW())`,
            [sub.user_id, `Renouvellement J-${joursRestants}`, `Votre abonnement ${sub.plan} expire dans ${joursRestants} jour(s)`])
          notifSent.push(key)
          await pool.query('UPDATE subscriptions SET notif_sent = $1 WHERE id = $2', [JSON.stringify(notifSent), sub.id])
          console.log(`  📧 Rappel J-${joursRestants} → ${sub.email}`)
        }
      }
      if (joursRestants < 0 && sub.statut === 'actif') {
        await pool.query(`UPDATE subscriptions SET statut = 'expire' WHERE id = $1`, [sub.id])
        await pool.query(`UPDATE users SET plan = 'freemium' WHERE id = $1`, [sub.user_id])
        console.log(`  ⏰ Abonnement expiré → ${sub.email}`)
      }
    }
  } catch (err) {
    console.error('❌ [CRON] Erreur renouvellements:', err.message)
  }
}

async function checkAbandonedOrders() {
  console.log('🛒 [CRON] Vérification paniers abandonnés...')
  try {
    const result = await pool.query(`
      SELECT o.*, u.email, u.prenom FROM orders o JOIN users u ON o.user_id = u.id
      WHERE o.statut = 'en_attente' AND o.created_at < NOW() - INTERVAL '2 hours'
      AND o.relance_count < 3
      AND (o.last_relance_at IS NULL OR o.last_relance_at < NOW() - INTERVAL '24 hours')`)
    for (const order of result.rows) {
      await emailService.sendAbandonedOrderEmail({ email: order.email, prenom: order.prenom }, order)
      await pool.query(`UPDATE orders SET relance_count = relance_count + 1, last_relance_at = NOW() WHERE id = $1`, [order.id])
      console.log(`  🛒 Relance #${order.relance_count + 1} → ${order.email}`)
    }
  } catch (err) {
    console.error('❌ [CRON] Erreur paniers abandonnés:', err.message)
  }
}

function startCronJobs() {
  cron.schedule('0 8 * * *', checkRenewalNotifications, { timezone: 'Africa/Libreville' })
  cron.schedule('0 10 * * *', checkAbandonedOrders,      { timezone: 'Africa/Libreville' })
  console.log('⏰ Tâches planifiées démarrées (Africa/Libreville)')
}

module.exports = { startCronJobs, checkRenewalNotifications, checkAbandonedOrders }