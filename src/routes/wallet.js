const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { COUNTRY_NAMES, WITHDRAWAL_SERVICES, WITHDRAWAL_RULES } = require('../countries');
const { notifyUser, notifyAdmins } = require('../notify');

const router = express.Router();

// Middleware : seul un utilisateur connecté peut consulter son portefeuille.
router.use((req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  next();
});

// Normalise un numéro de téléphone : retire espaces, tirets, points, parenthèses.
function normalizePhone(phone) {
  return String(phone || '').replace(/[\s\-().]/g, '');
}

// Accepte un numéro avec ou sans indicatif, 8 à 15 chiffres.
function isValidPhone(phone) {
  return /^\+?\d{8,15}$/.test(phone);
}

// Récupère le solde (dépôt + revenu). Crée le portefeuille s'il n'existe pas.
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    await pool.query(
      'INSERT INTO wallets (user_id, depot, revenu) VALUES ($1, 0, 0) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );
    const { rows } = await pool.query(
      'SELECT depot, revenu FROM wallets WHERE user_id = $1',
      [userId]
    );
    const w = rows[0] || { depot: 0, revenu: 0 };
    return res.json({ depot: Number(w.depot), revenu: Number(w.revenu) });
  } catch (err) {
    console.error('[wallet]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Services Mobile Money et règles de retrait disponibles.
router.get('/services', (req, res) => {
  return res.json({
    services: WITHDRAWAL_SERVICES,
    rules: WITHDRAWAL_RULES,
  });
});

// Demande de retrait : débite le revenu disponible et enregistre l'opération en attente.
router.post('/withdraw', async (req, res) => {
  const userId = req.session.userId;
  const { amount, country, service, phone } = req.body || {};

  // --- Validation du montant ---
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Montant invalide.' });
  }
  if (amt < WITHDRAWAL_RULES.minAmount) {
    return res
      .status(400)
      .json({ error: `Le montant minimum de retrait est de ${WITHDRAWAL_RULES.minAmount} FCFA.` });
  }

  // --- Validation du pays ---
  if (!COUNTRY_NAMES.includes(country)) {
    return res.status(400).json({ error: 'Pays invalide.' });
  }

  // --- Validation du service Mobile Money ---
  const countryServices = WITHDRAWAL_SERVICES[country] || [];
  const svc = countryServices.find((s) => s.id === service);
  if (!svc) {
    return res.status(400).json({ error: 'Service Mobile Money indisponible pour ce pays.' });
  }

  // --- Validation du numéro destinataire ---
  const p = normalizePhone(phone);
  if (!isValidPhone(p)) {
    return res.status(400).json({ error: 'Numéro de portefeuille invalide.' });
  }

  // --- Calcul des frais (pourcentage) et du net ---
  const fee = Math.round(amt * WITHDRAWAL_RULES.feeRate);
  const net = amt - fee;
  if (net <= 0) {
    return res.status(400).json({ error: 'Montant net invalide.' });
  }

  try {
    // Débit atomique du revenu disponible (protège contre les retraits concurrents).
    const debitRes = await pool.query(
      'UPDATE wallets SET revenu = revenu - $1, updated_at = NOW() WHERE user_id = $2 AND revenu >= $1 RETURNING revenu',
      [amt, userId]
    );

    if (debitRes.rowCount === 0) {
      const w = await pool.query('SELECT revenu FROM wallets WHERE user_id = $1', [userId]);
      const revenu = w.rows.length ? Number(w.rows[0].revenu) : 0;
      return res.status(400).json({ error: 'Solde revenu insuffisant.', revenu });
    }

    const reference =
      'WDR' + Date.now().toString() + crypto.randomBytes(2).toString('hex').toUpperCase();
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, reference, details)
       VALUES ($1, 'withdrawal', $2, 'pending', $3, $4)`,
      [
        userId,
        amt,
        reference,
        JSON.stringify({ fee, net, country, service: svc.name, phone: p }),
      ]
    );

    await notifyUser(
      userId,
      'Demande de retrait enregistrée',
      `Votre retrait de ${amt} FCFA est en attente de traitement.`,
      'info'
    );

    return res.json({
      success: true,
      status: 'pending',
      message: 'Demande de retrait enregistrée. Elle est en attente de traitement.',
      reference,
      amount: amt,
      fee,
      net,
      revenu: Number(debitRes.rows[0].revenu),
    });
  } catch (err) {
    console.error('[wallet:withdraw]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Demande de dépôt (Mobile Money) — en attente de validation admin.
router.post('/deposit', async (req, res) => {
  const userId = req.session.userId;
  const { amount, phone, service, country } = req.body || {};
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide.' });
  if (amt < 2500) return res.status(400).json({ error: 'Le dépôt minimum est de 2 500 FCFA.' });
  const p = normalizePhone(phone);
  if (!isValidPhone(p)) return res.status(400).json({ error: 'Numéro de portefeuille invalide.' });
  if (!COUNTRY_NAMES.includes(country)) return res.status(400).json({ error: 'Pays invalide.' });

  try {
    const reference = 'DEP' + Date.now().toString() + crypto.randomBytes(2).toString('hex').toUpperCase();
    await pool.query(
      "INSERT INTO transactions (user_id, type, amount, status, reference, details) VALUES ($1, 'deposit', $2, 'pending', $3, $4)",
      [userId, amt, reference, JSON.stringify({ phone: p, service: service || 'Mobile Money', country })]
    );
    await notifyAdmins('Nouvelle demande de dépôt', `Un dépôt de ${amt} FCFA est en attente de validation.`, 'info');
    return res.status(201).json({
      success: true,
      message: 'Demande de dépôt enregistrée. En attente de validation.',
      reference,
    });
  } catch (err) {
    console.error('[wallet:deposit]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
