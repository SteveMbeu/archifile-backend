
const path  = require('path')
const fs    = require('fs')
const { v4: uuidv4 } = require('uuid')
const pool  = require('../config/database')

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_PATH || './uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const PLAN_LIMITS = {
  freemium:   { docs: 100,    storage_bytes: 1   * 1024 * 1024 * 1024 },
  starter:    { docs: 1000,   storage_bytes: 10  * 1024 * 1024 * 1024 },
  pro:        { docs: 10000,  storage_bytes: 100 * 1024 * 1024 * 1024 },
  enterprise: { docs: 999999, storage_bytes: 999 * 1024 * 1024 * 1024 },
}

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} Mo`
  return `${(bytes / 1024 ** 3).toFixed(2)} Go`
}

async function uploadDocument(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu' })
    const { dossier = 'Général', description, tags } = req.body
    const plan   = req.user.plan || 'freemium'
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.freemium
    const countResult = await pool.query('SELECT COUNT(*), COALESCE(SUM(taille_bytes), 0) AS total_bytes FROM documents WHERE user_id = $1', [req.user.id])
    const { count, total_bytes } = countResult.rows[0]
    if (parseInt(count) >= limits.docs) { fs.unlinkSync(req.file.path); return res.status(403).json({ success: false, message: `Limite de ${limits.docs} documents atteinte` }) }
    if (parseInt(total_bytes) + req.file.size > limits.storage_bytes) { fs.unlinkSync(req.file.path); return res.status(403).json({ success: false, message: 'Stockage insuffisant' }) }
    const ext    = path.extname(req.file.originalname).toLowerCase().replace('.', '')
    const result = await pool.query(
      `INSERT INTO documents (user_id, nom_original, nom_stockage, type_mime, extension, taille_bytes, dossier, description, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, ext, req.file.size, dossier, description || null, tags ? JSON.stringify(tags.split(',').map(t => t.trim())) : '[]']
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) {
    console.error('uploadDocument error:', err)
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function getDocuments(req, res) {
  try {
    const { search, dossier, extension, est_favori, page = 1, limit = 50 } = req.query
    const offset = (page - 1) * limit
    const conditions = ['user_id = $1', 'est_archive = FALSE']
    const values     = [req.user.id]
    let idx = 2
    if (search)     { conditions.push(`nom_original ILIKE $${idx++}`); values.push(`%${search}%`) }
    if (dossier)    { conditions.push(`dossier = $${idx++}`);          values.push(dossier) }
    if (extension)  { conditions.push(`extension = $${idx++}`);        values.push(extension) }
    if (est_favori) { conditions.push(`est_favori = TRUE`) }
    const where = `WHERE ${conditions.join(' AND ')}`
    const [countResult, docsResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM documents ${where}`, values),
      pool.query(`SELECT * FROM documents ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...values, limit, offset]),
    ])
    const storageResult = await pool.query('SELECT COALESCE(SUM(taille_bytes), 0) AS used_bytes FROM documents WHERE user_id = $1 AND est_archive = FALSE', [req.user.id])
    const plan      = req.user.plan || 'freemium'
    const limits    = PLAN_LIMITS[plan] || PLAN_LIMITS.freemium
    const usedBytes = parseInt(storageResult.rows[0].used_bytes)
    res.json({ success: true, data: { documents: docsResult.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), storage: { used_bytes: usedBytes, max_bytes: limits.storage_bytes, used_pct: Math.round((usedBytes / limits.storage_bytes) * 100), used_display: formatBytes(usedBytes), max_display: formatBytes(limits.storage_bytes) } } })
  } catch (err) {
    console.error('getDocuments error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function downloadDocument(req, res) {
  try {
    const result = await pool.query('SELECT * FROM documents WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Document introuvable' })
    const doc      = result.rows[0]
    const filePath = path.join(UPLOAD_DIR, doc.nom_stockage)
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Fichier introuvable sur le serveur' })
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.nom_original)}"`)
    res.setHeader('Content-Type', doc.type_mime || 'application/octet-stream')
    res.sendFile(filePath)
  } catch (err) {
    console.error('downloadDocument error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function updateDocument(req, res) {
  try {
    const { dossier, description, tags, est_favori } = req.body
    const fields = [], values = []
    let idx = 1
    if (dossier !== undefined)     { fields.push(`dossier = $${idx++}`);     values.push(dossier) }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description) }
    if (tags !== undefined)        { fields.push(`tags = $${idx++}`);        values.push(JSON.stringify(tags)) }
    if (est_favori !== undefined)  { fields.push(`est_favori = $${idx++}`);  values.push(est_favori) }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Aucune donnée à modifier' })
    values.push(req.params.id, req.user.id)
    const result = await pool.query(`UPDATE documents SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`, values)
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Document introuvable' })
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    console.error('updateDocument error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function deleteDocument(req, res) {
  try {
    const result = await pool.query('SELECT nom_stockage FROM documents WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Document introuvable' })
    const filePath = path.join(UPLOAD_DIR, result.rows[0].nom_stockage)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    await pool.query('DELETE FROM documents WHERE id = $1', [req.params.id])
    res.json({ success: true, message: 'Document supprimé' })
  } catch (err) {
    console.error('deleteDocument error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

async function bulkDeleteDocuments(req, res) {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'IDs requis' })
    const result = await pool.query(`SELECT nom_stockage FROM documents WHERE id = ANY($1) AND user_id = $2`, [ids, req.user.id])
    result.rows.forEach(doc => { const fp = path.join(UPLOAD_DIR, doc.nom_stockage); if (fs.existsSync(fp)) fs.unlinkSync(fp) })
    await pool.query('DELETE FROM documents WHERE id = ANY($1) AND user_id = $2', [ids, req.user.id])
    res.json({ success: true, message: `${result.rows.length} document(s) supprimé(s)` })
  } catch (err) {
    console.error('bulkDeleteDocuments error:', err)
    res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
}

module.exports = { uploadDocument, getDocuments, downloadDocument, updateDocument, deleteDocument, bulkDeleteDocuments }