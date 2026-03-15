
const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
})
transporter.verify((err) => {
  if (err) console.error('❌ Erreur email Gmail:', err.message)
  else     console.log('✅ Service email Gmail prêt')
})

const baseStyle = `font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;`

const headerHtml = (titre) => `
  <div style="background:linear-gradient(135deg,#14532D,#16A34A);padding:32px 40px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;font-size:24px;margin:0;font-weight:900;">🗂 Archi<span style="color:#4ADE80">file</span></h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${titre}</p>
  </div>`

const footerHtml = `
  <div style="background:#F4FAF6;padding:24px 40px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #E2E8E4;">
    <p style="color:#6B7C72;font-size:12px;margin:0;">
      © ${new Date().getFullYear()} Techno Méga Partners — Libreville, Gabon<br>
      <a href="${process.env.FRONTEND_URL}" style="color:#16A34A;">archifile.com</a>
    </p>
  </div>`

async function sendEmail({ to, subject, html }) {
  try {
    await transporter.sendMail({ from: process.env.EMAIL_FROM || 'Archifile <noreply@archifile.com>', to, subject, html })
    console.log(`📧 Email envoyé à ${to}: ${subject}`)
    return true
  } catch (err) {
    console.error(`❌ Erreur email vers ${to}:`, err.message)
    return false
  }
}

async function sendVerificationEmail(user, token) {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`
  return sendEmail({
    to: user.email, subject: '✅ Confirmez votre compte Archifile',
    html: `<div style="${baseStyle}">${headerHtml('Confirmez votre adresse email')}
      <div style="padding:32px 40px;">
        <p style="color:#1A2E22;font-size:16px;">Bonjour <strong>${user.prenom || user.email}</strong>,</p>
        <p style="color:#6B7C72;line-height:1.6;">Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${url}" style="background:#16A34A;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Confirmer mon email →</a>
        </div>
        <p style="color:#9CB5A4;font-size:13px;text-align:center;">Ce lien expire dans 24 heures.</p>
      </div>${footerHtml}</div>`,
  })
}

async function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email, subject: '🎉 Bienvenue sur Archifile !',
    html: `<div style="${baseStyle}">${headerHtml('Bienvenue sur Archifile !')}
      <div style="padding:32px 40px;">
        <p style="color:#1A2E22;font-size:16px;">Bonjour <strong>${user.prenom || 'cher utilisateur'}</strong> 👋</p>
        <p style="color:#6B7C72;line-height:1.6;">Votre compte est activé. Vous bénéficiez de <strong>2 semaines d'essai gratuit</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#16A34A;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Accéder à mon espace →</a>
        </div>
      </div>${footerHtml}</div>`,
  })
}

async function sendResetPasswordEmail(user, token) {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
  return sendEmail({
    to: user.email, subject: '🔑 Réinitialisation de votre mot de passe Archifile',
    html: `<div style="${baseStyle}">${headerHtml('Réinitialisation du mot de passe')}
      <div style="padding:32px 40px;">
        <p style="color:#1A2E22;font-size:16px;">Bonjour <strong>${user.prenom || user.email}</strong>,</p>
        <p style="color:#6B7C72;line-height:1.6;">Une demande de réinitialisation de mot de passe a été effectuée.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${url}" style="background:#3B82F6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Réinitialiser mon mot de passe →</a>
        </div>
        <p style="color:#9CB5A4;font-size:13px;text-align:center;">Ce lien expire dans 1 heure.</p>
      </div>${footerHtml}</div>`,
  })
}

async function sendPaymentConfirmationEmail(user, order) {
  return sendEmail({
    to: user.email, subject: `🧾 Confirmation de paiement — Commande ${order.numero}`,
    html: `<div style="${baseStyle}">${headerHtml('Confirmation de votre commande')}
      <div style="padding:32px 40px;">
        <p style="color:#1A2E22;font-size:16px;">Bonjour <strong>${user.prenom || user.email}</strong>,</p>
        <p style="color:#6B7C72;line-height:1.6;">Votre paiement a bien été reçu.</p>
        <div style="background:#F4FAF6;border:1px solid #E2E8E4;border-radius:8px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#6B7C72;padding:6px 0;">Commande</td><td style="color:#1A2E22;font-weight:700;text-align:right;">${order.numero}</td></tr>
            <tr><td style="color:#6B7C72;padding:6px 0;">Plan</td><td style="color:#1A2E22;text-align:right;">${order.plan} (${order.frequence})</td></tr>
            <tr><td style="color:#6B7C72;padding:6px 0;">Montant HT</td><td style="color:#1A2E22;text-align:right;">${Number(order.montant_ht).toLocaleString('fr-FR')} XAF</td></tr>
            <tr><td style="color:#6B7C72;padding:6px 0;">TVA (${order.taux_taxe}%)</td><td style="color:#1A2E22;text-align:right;">${Number(order.montant_taxe).toLocaleString('fr-FR')} XAF</td></tr>
            <tr style="border-top:2px solid #E2E8E4;"><td style="color:#1A2E22;font-weight:900;padding:10px 0 0;">Total TTC</td><td style="color:#16A34A;font-weight:900;font-size:18px;text-align:right;padding-top:10px;">${Number(order.montant_total).toLocaleString('fr-FR')} XAF</td></tr>
          </table>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/subscription" style="background:#16A34A;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;">Voir mon abonnement →</a>
        </div>
      </div>${footerHtml}</div>`,
  })
}

async function sendRenewalReminderEmail(user, subscription, joursRestants) {
  const urgence = joursRestants <= 1 ? '🚨' : joursRestants <= 7 ? '⚠️' : '🔔'
  const message = joursRestants === 0 ? 'Votre abonnement expire <strong>aujourd\'hui</strong> !'
    : joursRestants === 1 ? 'Votre abonnement expire <strong>demain</strong> !'
    : `Votre abonnement expire dans <strong>${joursRestants} jours</strong>.`
  return sendEmail({
    to: user.email, subject: `${urgence} Renouvellement Archifile — J-${joursRestants}`,
    html: `<div style="${baseStyle}">${headerHtml(`Rappel renouvellement J-${joursRestants}`)}
      <div style="padding:32px 40px;">
        <p style="color:#1A2E22;font-size:16px;">Bonjour <strong>${user.prenom || user.email}</strong>,</p>
        <p style="color:#6B7C72;line-height:1.6;">${message}</p>
        <div style="background:#F4FAF6;border:1px solid #E2E8E4;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="color:#1A2E22;margin:0 0 4px;"><strong>Plan :</strong> ${subscription.plan} (${subscription.frequence})</p>
          <p style="color:#1A2E22;margin:0;"><strong>Expiration :</strong> ${new Date(subscription.ends_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/subscription" style="background:#16A34A;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;">Renouveler →</a>
        </div>
      </div>${footerHtml}</div>`,
  })
}

async function sendDemoRequestConfirmationEmail(demande) {
  return sendEmail({
    to: demande.email, subject: '📅 Votre demande de démonstration Archifile',
    html: `<div style="${baseStyle}">${headerHtml('Demande de démo reçue')}
      <div style="padding:32px 40px;">
        <p style="color:#1A2E22;font-size:16px;">Bonjour <strong>${demande.prenom} ${demande.nom}</strong>,</p>
        <p style="color:#6B7C72;line-height:1.6;">Nous avons bien reçu votre demande. Notre équipe vous contactera sous 48 heures.</p>
        <p style="color:#9CB5A4;font-size:13px;">Questions ? <a href="mailto:support@archifile.com" style="color:#16A34A;">support@archifile.com</a></p>
      </div>${footerHtml}</div>`,
  })
}

async function sendAbandonedOrderEmail(user, order) {
  return sendEmail({
    to: user.email, subject: '🛒 Finalisez votre abonnement Archifile',
    html: `<div style="${baseStyle}">${headerHtml('Finalisez votre abonnement')}
      <div style="padding:32px 40px;">
        <p style="color:#1A2E22;font-size:16px;">Bonjour <strong>${user.prenom || user.email}</strong>,</p>
        <p style="color:#6B7C72;line-height:1.6;">Vous avez commencé à configurer votre abonnement <strong>${order.plan}</strong> mais n'avez pas finalisé.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/payment" style="background:#3B82F6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;">Finaliser →</a>
        </div>
      </div>${footerHtml}</div>`,
  })
}

module.exports = { sendVerificationEmail, sendWelcomeEmail, sendResetPasswordEmail, sendPaymentConfirmationEmail, sendRenewalReminderEmail, sendDemoRequestConfirmationEmail, sendAbandonedOrderEmail }