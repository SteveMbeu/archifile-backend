
const crypto = require('crypto')

const ALGORITHM = 'aes-256-cbc'
const KEY       = Buffer.from((process.env.ENCRYPTION_KEY || 'archifile_encryption_key_32chars!').slice(0, 32))
const IV_LENGTH = 16

function encrypt(text) {
  if (!text) return null
  const iv        = crypto.randomBytes(IV_LENGTH)
  const cipher    = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(String(text)), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(encryptedText) {
  if (!encryptedText) return null
  try {
    const [ivHex, dataHex] = encryptedText.split(':')
    const iv        = Buffer.from(ivHex, 'hex')
    const data      = Buffer.from(dataHex, 'hex')
    const decipher  = crypto.createDecipheriv(ALGORITHM, KEY, iv)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    return decrypted.toString()
  } catch {
    return null
  }
}

function masque(value, visibleStart = 3, visibleEnd = 2) {
  if (!value) return null
  const str = String(value)
  if (str.length <= visibleStart + visibleEnd) return str
  const stars = '*'.repeat(str.length - visibleStart - visibleEnd)
  return str.slice(0, visibleStart) + stars + str.slice(-visibleEnd)
}

module.exports = { encrypt, decrypt, masque }