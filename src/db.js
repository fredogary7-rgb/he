const { Pool } = require('pg');
const crypto = require('crypto');
const { DATABASE_URL } = require('./config');

// Connexion PostgreSQL (Neon). SSL obligatoire pour le host "pooler" de Neon.
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Génère un code de parrainage unique (ex. KH3F2A9C1B).
function generateReferralCode() {
  return 'KH' + crypto.randomBytes(5).toString('hex').toUpperCase();
}

// Crée le schéma de base si nécessaire (+ migrations pour les bases existantes).
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              SERIAL PRIMARY KEY,
      country         VARCHAR(60)  NOT NULL,
      phone           VARCHAR(30)  NOT NULL,
      password_hash   TEXT         NOT NULL,
      invitation_code VARCHAR(60)  NOT NULL,
      referral_code   VARCHAR(30),
      referred_by     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
      is_admin        BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT users_country_phone_unique UNIQUE (country, phone)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      depot      NUMERIC(12, 2) NOT NULL DEFAULT 0,
      revenu     NUMERIC(12, 2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        VARCHAR(20) NOT NULL,
      amount      NUMERIC(12, 2) NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'pending',
      reference   VARCHAR(60),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       VARCHAR(120) NOT NULL,
      message     TEXT,
      type        VARCHAR(20) NOT NULL DEFAULT 'info',
      read        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender      VARCHAR(10) NOT NULL,
      content     TEXT,
      image_url   TEXT,
      read        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages (user_id, created_at);

    CREATE TABLE IF NOT EXISTS wheel_spins (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount      NUMERIC(12, 2) NOT NULL,
      spin_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS wheel_spins_user_date_idx ON wheel_spins (user_id, spin_date);
  `);

  // Migrations pour les bases déjà existantes.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(30)');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx ON users (referral_code) WHERE referral_code IS NOT NULL'
  );

  // Détails d'une transaction (destinataire, frais, etc. pour les retraits).
  await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS details JSONB');

  // Champ administrateur sur les comptes.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE');

  // Rétro-remplissage : attribue un code de parrainage aux comptes qui n'en ont pas.
  const missing = await pool.query(
    "SELECT id FROM users WHERE referral_code IS NULL OR referral_code = ''"
  );
  for (const row of missing.rows) {
    await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [
      generateReferralCode(),
      row.id,
    ]);
  }
}

// Test simple de connexion.
async function testConnection() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
}

module.exports = { pool, initSchema, testConnection, generateReferralCode };
