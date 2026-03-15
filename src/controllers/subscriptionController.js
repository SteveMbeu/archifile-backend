
const { v4: uuidv4 } = require('uuid')
const pool   = require('../config/database')
const { encrypt } = require('../utils/crypto')
const emailService = require('../services/emailService')

const PRIX = {
  starter:    { mensuel: 9900,  trimestriel: 28200,  annuel: 99000,   '2ans': 178200  },
  pro:        { mensuel: 24900, trimestriel: 71100,  annuel: 249000,  '2ans': 448200  },
  enterprise: { mensuel: 59900, trimestriel: 170100, annuel: 599000,  '2ans': 1078200 },
}
const REMISES  = { mensuel: 0, trimestriel: 5, annuel: 17, '2ans': 25 }
const TAX_RATE = parseFloat(process.env.TAX_RATE || 18)

function calculerMontants(plan, frequence) {
  const prixBase = PRIX[plan]?.[frequence]
  if (!prixBase) throw new Error(`Plan ou fréquence invalide: ${plan}/${frequence}`)
  const remise_pct  = REMISES[frequence] || 0
  const apresRemise = prixBase * (1 - remise_pct / 100)
  const taxe        = Math.round(apresRemise * TAX_RATE / 100)
  return { montant_ht: Math.round(apresRemise), taux_taxe: TAX_RATE, montant_taxe: taxe, remise_pct, montant_total: Math.round(apresRemise + taxe) }
}

function dateFinAbonnement(frequence) {
  const now = new Date()
  switch (frequence) {
    case 'mensuel':     return new Date(new Date().setMonth(now.getMonth() + 1))
    case 'trimestriel': return new Date(new Date().setMonth(now.getMonth() + 3))
    case 'annuel':      return new Date(new Date().setFullYear(now.getFullYear() + 1))
    case '2ans':        return new Date(new Date().setFullYear(now.getFullYear() + 2))
    default:            return new Date(new Date().setMonth(now.getMonth() + 1))
  }
}

function genNumeroCommande() {
  return `ARF-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
}

async function createOrder(req, res) {
  try {
    const { plan, frequence, methode_paiement, infos_paiement } = req.body
    if (!plan || !frequence || !methode_paiement) return res.status(400).json({ success: false, message: 'Plan, fréquence et méthode requis' })
    const montants = calculerMontants(plan, frequence)
    let carte_last4 = null, carte_expiry = null, carte_titulaire = null, paypal_email = null, mobile_numero = null
    if (methode_paiement === 'carte' && infos_paiement) {
      const num = infos_paiement.numero?.replace(/\s/g, '') || ''
      carte_last4 = num.slice(-4); carte_expiry = infos_paiement.expiry || null; carte_titulaire = infos_paiement.titulaire || null
    } else if (methode_paiement === 'paypal' && infos_paiement) {
      paypal_email = encrypt(infos_paiement.email)
    } else if (['airtel_money', 'moov_money'].includes(methode_paiement) && infos_paiement) {
      mobile_numero = encrypt(infos_paiement.numero)
    }
    const orderResult = await pool.query(
      `INSERT INTO orders (numero, user_id, plan, frequence, montant_ht, taux_taxe, montant_taxe, remise_pct, montant_total, methode_paiement, transaction_ref, carte_last4, carte_expiry, carte_titulaire, paypal_email, mobile_numero, ip_address, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'en_attente') RETURNING *`,
      [genNumeroCommande(), req.user.id, plan, frequence, montants.montant_ht, montants.taux_taxe, montants.montant_taxe, montants.remise_pct, montants.montant_total, methode_paiement, uuidv4(), carte_last4, carte_expiry, carte_titulaire, paypal_email, mobile_numero, req.ip]
    )
    const order = orderResult.rows[0]
    // Simulation paiement — intégrer Stripe/PayPal/Airtel en production
    const starts_at = new Date(), ends_at = dateFinAbonnement(frequence)
    const subResult = await pool.query(
      `INSERT INTO subscriptions (user_id, plan, frequence, statut, montant_ht, taux_taxe, montant_taxe, remise_pct, montant_total, starts_at, ends_at)
       VALUES ($1,$2,$3,'actif',$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, plan, frequence, montants.montant_ht, montants.taux_taxe, montants.montant_taxe, montants.remise_pct, montants.montant_total, starts_at, ends_at]
    )
    await Promise.all([
      pool.query(`UPDATE orders SET statut = 'traite', subscription_id = $1, paid_at = NOW() WHERE id = $2`, [subResult.rows[0].id, order.id]),
      pool.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, req.user.id]),
    ])
    const userResult = await pool.query('SELECT email, prenom FROM users WHERE id = $1', [req.user.id])
    await emailService.sendPaymentConfirmationEmail(userResult.rows[0], { ...order, ...montants })
    res.status(201).json({ success: true, message: 'Paiement effectué !', data: { order: { ...order, statut: 'traite' }, subscription: subResult.rows[0] } })
  } catch (err) {
    console.error('createOrder error:', err)
    res.status(500).json({ success: false, message: err.message || 'Erreur serveur' })
  }
}

async function getMySubscriptions(req, res) {
  try {
    const result = await pool.query(`SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.id])
    res.json({ success: true, data: result.rows })
  } catch (err) { res.status(500).json({ success: false, message: 'Erreur serveur' }) }
}

async function cancelSubscription(req, res) {
  try {
    const { cancel_reason } = req.body
    const result = await pool.query(`SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Abonnement introuvable' })
    const sub = result.rows[0]
    if (sub.statut !== 'actif') return res.status(400).json({ success: false, message: 'Cet abonnement ne peut pas être annulé' })
    await pool.query(`UPDATE subscriptions SET statut = 'annule', cancelled_at = NOW(), cancel_reason = $1, auto_renew = FALSE WHERE id = $2`, [cancel_reason || null, req.params.id])
    res.json({ success: true, message: `Abonnement annulé. Actif jusqu'au ${new Date(sub.ends_at).toLocaleDateString('fr-FR')}` })
  } catch (err) {
    console.error('cancelSubscription error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function getMyOrders(req, res) {
  try {
    const result = await pool.query(`SELECT id, numero, plan, frequence, montant_total, devise, statut, methode_paiement, carte_last4, paid_at, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.id])
    res.json({ success: true, data: result.rows })
  } catch (err) { res.status(500).json({ success: false, message: 'Erreur serveur' }) }
}

async function getTarifs(_req, res) {
  res.json({ success: true, data: { plans: [
    { id: 'freemium', nom: 'Freemium', prix: { mensuel: 0 }, features: ['100 documents', '1 Go', 'Recherche basique', 'Support email'] },
    { id: 'starter',  nom: 'Starter',  prix: PRIX.starter,  remises: REMISES, features: ['1 000 documents', '10 Go', 'Recherche avancée', 'Export PDF'] },
    { id: 'pro',      nom: 'Pro',      prix: PRIX.pro,      remises: REMISES, features: ['10 000 documents', '100 Go', 'OCR', 'API', 'Multi-users (5)'] },
    { id: 'enterprise', nom: 'Enterprise', prix: PRIX.enterprise, remises: REMISES, features: ['Illimité', 'SLA 99.9%', 'Account manager'] },
  ], devise: 'XAF', tax_rate: TAX_RATE } })
}

async function getAllOrders(req, res) {
  try {
    const { statut, search, page = 1, limit = 20 } = req.query
    const offset = (page - 1) * limit
    const conditions = [], values = []
    let idx = 1
    if (statut) { conditions.push(`o.statut = $${idx++}`); values.push(statut) }
    if (search) { conditions.push(`(o.numero ILIKE $${idx} OR u.email ILIKE $${idx})`); values.push(`%${search}%`); idx++ }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [countResult, ordersResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM orders o LEFT JOIN users u ON o.user_id = u.id ${where}`, values),
      pool.query(`SELECT o.*, u.email, u.prenom, u.nom FROM orders o LEFT JOIN users u ON o.user_id = u.id ${where} ORDER BY o.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...values, limit, offset]),
    ])
    res.json({ success: true, data: { orders: ordersResult.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), pages: Math.ceil(parseInt(countResult.rows[0].count) / limit) } })
  } catch (err) {
    console.error('getAllOrders error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

module.exports = { createOrder, getMySubscriptions, cancelSubscription, getMyOrders, getTarifs, getAllOrders }