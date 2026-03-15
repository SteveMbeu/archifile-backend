// src/routes/index.js
const express  = require('express')
const router   = express.Router()
const passport = require('../config/passport')
const { authenticate, requireAdmin, requireVerified } = require('../middlewares/auth')
const { upload, handleUploadError } = require('../middlewares/upload')
const authController         = require('../controllers/authController')
const userController         = require('../controllers/userController')
const documentController     = require('../controllers/documentController')
const subscriptionController = require('../controllers/subscriptionController')
const demoController         = require('../controllers/demoController')

// AUTH
const auth = express.Router()
auth.post('/register',        authController.register)
auth.get( '/verify-email',    authController.verifyEmail)
auth.post('/login',           authController.login)
auth.post('/refresh-token',   authController.refreshToken)
auth.post('/logout',          authenticate, authController.logout)
auth.post('/forgot-password', authController.forgotPassword)
auth.post('/reset-password',  authController.resetPassword)
auth.get( '/me',              authenticate, authController.getMe)

// Google OAuth
auth.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)
auth.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, userData, info) => {
      console.log('🔴 err:', err?.message)
      console.log('🔴 userData:', userData ? 'OK' : 'null')
      console.log('🔴 info:', JSON.stringify(info))
      if (err || !userData) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=google`)
      }
      const { user, tokens } = userData
      const params = new URLSearchParams({
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userId:       user.id,
        email:        user.email,
        prenom:       user.prenom || '',
        nom:          user.nom    || '',
        role:         user.role,
        plan:         user.plan,
      })
      res.redirect(`${process.env.FRONTEND_URL}/auth/google/success?${params}`)
    })(req, res, next)
  }
)

// NOTIFICATIONS
const notifications = express.Router()
notifications.use(authenticate)
notifications.get('/',           async (req, res) => {
  const { rows } = await require('../config/database').query(
    'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]
  )
  res.json({ success: true, notifications: rows })
})
notifications.put('/:id/read',   async (req, res) => {
  await require('../config/database').query(
    'UPDATE notifications SET est_lu=TRUE WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
  )
  res.json({ success: true })
})
notifications.put('/read-all',   async (req, res) => {
  await require('../config/database').query(
    'UPDATE notifications SET est_lu=TRUE WHERE user_id=$1', [req.user.id]
  )
  res.json({ success: true })
})
notifications.delete('/:id',     async (req, res) => {
  await require('../config/database').query(
    'DELETE FROM notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
  )
  res.json({ success: true })
})
notifications.delete('/',        async (req, res) => {
  await require('../config/database').query(
    'DELETE FROM notifications WHERE user_id=$1', [req.user.id]
  )
  res.json({ success: true })
})
router.use('/notifications', notifications)

router.use('/auth', auth)

// USERS
const users = express.Router()
users.use(authenticate)
users.put('/me/profile',  userController.updateProfile)
users.put('/me/password', userController.changePassword)
users.delete('/me',       userController.deleteAccount)
users.get('/',            requireAdmin, userController.getAllUsers)
users.get('/stats',       requireAdmin, userController.getAdminStats)
users.get('/:id',         requireAdmin, userController.getUserById)
users.put('/:id',         requireAdmin, userController.updateUser)
users.delete('/:id',      requireAdmin, userController.deleteUser)
router.use('/users', users)

// DOCUMENTS
const documents = express.Router()
documents.use(authenticate, requireVerified)
documents.get('/',             documentController.getDocuments)
documents.post('/',            upload.single('file'), handleUploadError, documentController.uploadDocument)
documents.get('/:id/download', documentController.downloadDocument)
documents.put('/:id',          documentController.updateDocument)
documents.delete('/bulk',      documentController.bulkDeleteDocuments)
documents.delete('/:id',       documentController.deleteDocument)
router.use('/documents', documents)

// ABONNEMENTS
const subscriptions = express.Router()
subscriptions.use(authenticate)
subscriptions.get('/',       subscriptionController.getMySubscriptions)
subscriptions.post('/order', requireVerified, subscriptionController.createOrder)
subscriptions.delete('/:id', subscriptionController.cancelSubscription)
router.use('/subscriptions', subscriptions)

// COMMANDES
const orders = express.Router()
orders.use(authenticate)
orders.get('/me',    subscriptionController.getMyOrders)
orders.get('/admin', requireAdmin, subscriptionController.getAllOrders)
router.use('/orders', orders)

// TARIFS (public)
router.get('/tarifs', subscriptionController.getTarifs)

// DEMO
const demo = express.Router()
demo.post('/',   demoController.createDemoRequest)
demo.get('/',    authenticate, requireAdmin, demoController.getAllDemoRequests)
demo.put('/:id', authenticate, requireAdmin, demoController.updateDemoStatus)
router.use('/demo', demo)

// HEALTH
router.get('/health', (_req, res) => res.json({ success: true, service: 'Archifile API', version: '1.0.0', timestamp: new Date().toISOString() }))

module.exports = router