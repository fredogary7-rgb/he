const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Gains de la roue (entre 25 et 100 FCFA).
const PRIZES = [25, 30, 40, 50, 60, 75, 80, 100];

// Middleware : seul un utilisateur connecté peut jouer.
router.use((req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  next();
});

// Statut du tour du jour.
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT amount, created_at FROM wheel_spins WHERE user_id = $1 AND spin_date = CURRENT_DATE LIMIT 1',
      [req.session.userId]
    );
    const last = rows[0];
    return res.json({
      alreadySpun: rows.length > 0,
      lastSpin: last ? { amount: Number(last.amount), createdAt: last.created_at } : null,
    });
  } catch (err) {
    console.error('[wheel]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Tourne la roue : 1 fois par jour, gain crédité sur le solde revenu.
router.post('/spin', async (req, res) => {
  const userId = req.session.userId;
  const amount = PRIZES[Math.floor(Math.random() * PRIZES.length)];

  try {
    // Réserve le tour du jour (contrainte unique) — empêche les doubles tours.
    const spin = await pool.query(
      'INSERT INTO wheel_spins (user_id, amount) VALUES ($1, $2) ON CONFLICT (user_id, spin_date) DO NOTHING RETURNING id',
      [userId, amount]
    );
    if (spin.rowCount === 0) {
      return res.status(400).json({ error: 'Vous avez déjà joué aujourd\u2019hui. Revenez demain.' });
    }

    // Crédite le gain sur le solde revenu.
    const w = await pool.query(
      'INSERT INTO wallets (user_id, depot, revenu) VALUES ($1, 0, $2) ON CONFLICT (user_id) DO UPDATE SET revenu = wallets.revenu + $2, updated_at = NOW() RETURNING revenu',
      [userId, amount]
    );

    return res.json({
      success: true,
      amount,
      revenu: Number(w.rows[0].revenu),
      message: `Vous avez gagné ${amount} FCFA !`,
    });
  } catch (err) {
    console.error('[wheel:spin]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;