const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Middleware : seul un utilisateur connecté peut consulter ses notifications.
router.use((req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  next();
});

// Liste des notifications (récentes d'abord) + nombre de non lues.
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const { rows } = await pool.query(
      `SELECT id, title, message, type, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    const unreadRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [userId]
    );
    return res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        createdAt: n.created_at,
      })),
      unread: unreadRes.rows[0].count,
    });
  } catch (err) {
    console.error('[notifications]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Marquer toutes les notifications comme lues.
router.post('/read', async (req, res) => {
  try {
    const userId = req.session.userId;
    await pool.query('UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE', [userId]);
    return res.json({ message: 'Notifications marquées comme lues.' });
  } catch (err) {
    console.error('[notifications]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;