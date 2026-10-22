const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

// Catalogue des produits (offres d'investissement KOUZ HOUS).
// ⚠ INCOHÉRENCE SIGNALÉE — Produit 1 : 980 FCFA/jour × 35 jours = 34 300 FCFA,
// alors que le total annoncé est 32 100 FCFA. Les valeurs sont reproduites telles
// que fournies ; à confirmer avant mise en ligne.
const PRODUCTS = [
  { id: 1, name: 'KOUZ HOUS 1', price: 8000, dailyRevenue: 980, totalRevenue: 32100, durationDays: 35, image: '/images/moto1.jpg' },
  { id: 2, name: 'KOUZ HOUS 2', price: 15000, dailyRevenue: 1600, totalRevenue: 56000, durationDays: 35, image: '/images/velo.jpg' },
  { id: 3, name: 'KOUZ HOUS 3', price: 20000, dailyRevenue: 2100, totalRevenue: 73500, durationDays: 35, image: '/images/casque.jpg' },
  { id: 4, name: 'KOUZ HOUS 4', price: 30000, dailyRevenue: 3400, totalRevenue: 119000, durationDays: 35, image: '/images/rol.jpg' },
  { id: 5, name: 'KOUZ HOUS 5', price: 50000, dailyRevenue: 5900, totalRevenue: 206500, durationDays: 35, image: '/images/pous.jpg' },
  { id: 6, name: 'KOUZ HOUS 6', price: 80000, dailyRevenue: 8900, totalRevenue: 311500, durationDays: 35, image: '/images/vent.jpg' },
  { id: 7, name: 'KOUZ HOUS 7', price: 100000, dailyRevenue: 12000, totalRevenue: 420000, durationDays: 35, image: '/images/moto3.jpg' },
];

// Catalogue public (aucune authentification requise).
router.get('/', (req, res) => {
  res.json({ products: PRODUCTS });
});

// Achat d'un produit : débite le solde "depot" (transaction atomique).
router.post('/:id/buy', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  const userId = req.session.userId;
  const productId = parseInt(req.params.id, 10);
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Produit introuvable.' });
  }

  try {
    // Débit atomique : ne réussit que si le solde dépôt est suffisant.
    const debitRes = await pool.query(
      'UPDATE wallets SET depot = depot - $1, updated_at = NOW() WHERE user_id = $2 AND depot >= $1 RETURNING depot',
      [product.price, userId]
    );

    if (debitRes.rowCount === 0) {
      const w = await pool.query('SELECT depot FROM wallets WHERE user_id = $1', [userId]);
      const depot = w.rows.length ? Number(w.rows[0].depot) : 0;
      return res.status(400).json({ error: 'Solde dépôt insuffisant.', depot });
    }

    const reference =
      'ACH' + Date.now().toString() + crypto.randomBytes(2).toString('hex').toUpperCase();
    await pool.query(
      "INSERT INTO transactions (user_id, type, amount, status, reference) VALUES ($1, 'purchase', $2, 'success', $3)",
      [userId, product.price, reference]
    );

    return res.json({
      success: true,
      message: 'Achat confirmé.',
      depot: Number(debitRes.rows[0].depot),
      product: { id: product.id, name: product.name, price: product.price },
      reference,
    });
  } catch (err) {
    console.error('[products:buy]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;