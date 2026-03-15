
const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
const { v4: uuidv4 } = require('uuid')

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_PATH || './uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/csv':   'csv',
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) cb(null, true)
  else cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`), false)
}

const MAX_SIZE_BYTES = (parseInt(process.env.UPLOAD_MAX_SIZE_MB || 50)) * 1024 * 1024

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } })

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: `Fichier trop volumineux. Max : ${process.env.UPLOAD_MAX_SIZE_MB || 50} Mo`,
      })
    }
    return res.status(400).json({ success: false, message: err.message })
  }
  if (err) return res.status(400).json({ success: false, message: err.message })
  next()
}

module.exports = { upload, handleUploadError }