
require('dotenv').config()
const pool = require('./database')

const migrations = [

  `CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),
    google_id       VARCHAR(255),
    titre           VARCHAR(20)  DEFAULT 'M.',
    prenom          VARCHAR(100),
    nom             VARCHAR(100),
    telephone       TEXT,
    pays            VARCHAR(100) DEFAULT 'Gabon',
    adresse_facturation TEXT,
    role            VARCHAR(20)  DEFAULT 'user' CHECK (role IN ('user','admin')),
    plan            VARCHAR(30)  DEFAULT 'freemium' CHECK (plan IN ('freemium','starter','pro','enterprise')),
    is_verified     BOOLEAN      DEFAULT FALSE,
    verify_token    VARCHAR(255),
    verify_token_expires TIMESTAMPTZ,
    reset_token     VARCHAR(255),
    reset_token_expires  TIMESTAMPTZ,
    refresh_token   TEXT,
    freemium_starts_at   TIMESTAMPTZ DEFAULT NOW(),
    freemium_expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    last_login_at   TIMESTAMPTZ,
    login_history   JSONB        DEFAULT '[]',
    preferences     JSONB        DEFAULT '{"lang":"fr","notifications":{"email":true,"whatsapp":false,"telegram":false}}',
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan            VARCHAR(30)  NOT NULL CHECK (plan IN ('starter','pro','enterprise')),
    frequence       VARCHAR(20)  NOT NULL CHECK (frequence IN ('mensuel','trimestriel','annuel','2ans')),
    statut          VARCHAR(30)  DEFAULT 'en_attente' CHECK (statut IN ('actif','inactif','en_attente','annule','expire')),
    montant_ht      DECIMAL(12,2) NOT NULL,
    taux_taxe       DECIMAL(5,2)  DEFAULT 18.00,
    montant_taxe    DECIMAL(12,2) NOT NULL,
    remise_pct      DECIMAL(5,2)  DEFAULT 0,
    montant_total   DECIMAL(12,2) NOT NULL,
    devise          VARCHAR(10)   DEFAULT 'XAF',
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,
    auto_renew      BOOLEAN       DEFAULT TRUE,
    notif_sent      JSONB         DEFAULT '[]',
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero          VARCHAR(30) UNIQUE NOT NULL,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    plan            VARCHAR(30)  NOT NULL,
    frequence       VARCHAR(20)  NOT NULL,
    montant_ht      DECIMAL(12,2) NOT NULL,
    taux_taxe       DECIMAL(5,2)  DEFAULT 18.00,
    montant_taxe    DECIMAL(12,2) NOT NULL,
    remise_pct      DECIMAL(5,2)  DEFAULT 0,
    montant_total   DECIMAL(12,2) NOT NULL,
    devise          VARCHAR(10)   DEFAULT 'XAF',
    statut          VARCHAR(30)   DEFAULT 'en_attente' CHECK (statut IN ('en_attente','traite','echoue','rembourse','abandonne')),
    methode_paiement VARCHAR(30)  CHECK (methode_paiement IN ('carte','paypal','airtel_money','moov_money')),
    transaction_ref TEXT,
    carte_last4     VARCHAR(10),
    carte_expiry    VARCHAR(10),
    carte_titulaire VARCHAR(255),
    paypal_email    TEXT,
    mobile_numero   TEXT,
    ip_address      VARCHAR(50),
    abandon_step    VARCHAR(50),
    relance_count   INTEGER       DEFAULT 0,
    last_relance_at TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_original    VARCHAR(500) NOT NULL,
    nom_stockage    VARCHAR(500) NOT NULL,
    type_mime       VARCHAR(100),
    extension       VARCHAR(20),
    taille_bytes    BIGINT,
    dossier         VARCHAR(100) DEFAULT 'Général',
    est_favori      BOOLEAN      DEFAULT FALSE,
    est_archive     BOOLEAN      DEFAULT FALSE,
    pages           INTEGER,
    description     TEXT,
    tags            JSONB        DEFAULT '[]',
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS demo_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             VARCHAR(100) NOT NULL,
    prenom          VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    telephone       VARCHAR(50),
    entreprise      VARCHAR(255),
    type_entreprise VARCHAR(100),
    secteur         VARCHAR(100),
    taille_entreprise VARCHAR(50),
    objectifs       TEXT,
    defis           TEXT,
    nb_utilisateurs VARCHAR(50),
    date_preferee   DATE,
    heure_preferee  TIME,
    langue          VARCHAR(10)  DEFAULT 'fr',
    plateforme_visio VARCHAR(100),
    statut          VARCHAR(30)  DEFAULT 'en_attente' CHECK (statut IN ('en_attente','confirmee','realisee','annulee','reportee')),
    commentaires    TEXT,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50)  NOT NULL,
    titre           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    canal           VARCHAR(20)  DEFAULT 'email' CHECK (canal IN ('email','whatsapp','telegram','inapp')),
    est_lu          BOOLEAN      DEFAULT FALSE,
    envoye          BOOLEAN      DEFAULT FALSE,
    envoye_at       TIMESTAMPTZ,
    metadata        JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ  DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role           ON users(role)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_statut ON subscriptions(statut)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_ends   ON subscriptions(ends_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user          ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_statut        ON orders(statut)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_user       ON documents(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_lu     ON notifications(user_id, est_lu)`,

  `CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
  $$ LANGUAGE plpgsql`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated')
    THEN CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subs_updated')
    THEN CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_updated')
    THEN CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_docs_updated')
    THEN CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF;
  END $$`,
]

async function migrate() {
  console.log('🚀 Démarrage des migrations...\n')
  const client = await pool.connect()
  try {
    for (let i = 0; i < migrations.length; i++) {
      await client.query(migrations[i])
      const label = migrations[i].trim().split('\n')[0].slice(0, 60)
      console.log(`  ✅ [${i + 1}/${migrations.length}] ${label}`)
    }
    console.log('\n✅ Toutes les migrations réussies !')
  } catch (err) {
    console.error('\n❌ Erreur migration:', err.message)
    process.exit(1)
  } finally {
    client.release()
    pool.end()
  }
}

if (require.main === module) migrate()
module.exports = { migrate }