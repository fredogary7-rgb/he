const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const TYPES = ['deposit', 'withdrawal', 'revenue', 'commission', 'purchase'];
const STATUSES = ['success', 'pending', 'failed', 'refused', 'cancelled'];
const PERIODS = { '7': 7, '30': 30, '90': 90 };

// Middleware : seul un utilisateur connecté peut consulter son historique.
router.use((req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  next();
});

// GET /api/history?type=&status=&q=&period=&limit=&offset=
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const type = TYPES.includes(req.query.type) ? req.query.type : null;
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    const q = (req.query.q || '').trim();
    const period = PERIODS[req.query.period] || null;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // Résumé global (uniquement les opérations réussies, par type).
    const summaryRes = await pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE type = 'deposit' AND status = 'success'), 0) AS deposits,
         COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal' AND status = 'success'), 0) AS withdrawals,
         COALESCE(SUM(amount) FILTER (WHERE type = 'revenue' AND status = 'success'), 0) AS revenues,
         COALESCE(SUM(amount) FILTER (WHERE type = 'commission' AND status = 'success'), 0) AS commissions
       FROM transactions
       WHERE user_id = $1`,
      [userId]
    );
    const s = summaryRes.rows[0];

    // Construction de la requête filtrée.
    const conditions = ['user_id = $1'];
    const params = [userId];
    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`reference ILIKE $${params.length}`);
    }
    if (period) {
      conditions.push(`created_at >= NOW() - INTERVAL '${period} days'`);
    }
    const where = conditions.join(' AND ');

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM transactions WHERE ${where}`,
      params
    );
    const total = totalRes.rows[0].count;

    const listParams = [...params, limit, offset];
    const listRes = await pool.query(
      `SELECT id, type, amount, status, reference, created_at
       FROM transactions
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    return res.json({
      summary: {
        totalDeposits: Number(s.deposits),
        totalWithdrawals: Number(s.withdrawals),
        totalRevenues: Number(s.revenues),
        totalCommissions: Number(s.commissions),
      },
      transactions: listRes.rows.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        status: t.status,
        reference: t.reference,
        createdAt: t.created_at,
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[history]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;