const express = require('express');
const { pool } = require('../db');
const { saveImage } = require('../uploads');
const { ADMIN_PASSWORD } = require('../config');
const { notifyUser } = require('../notify');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Accès administrateur requis.' });
  }
  next();
}

function toMessage(m) {
  return {
    id: m.id,
    sender: m.sender,
    content: m.content,
    imageUrl: m.image_url,
    read: m.read,
    createdAt: m.created_at,
  };
}

// Connexion administrateur
router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Mot de passe administrateur incorrect.' });
});

// Déconnexion administrateur
router.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  return res.json({ success: true });
});

// Statut de la session admin
router.get('/status', (req, res) => {
  return res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Liste des conversations (utilisateurs ayant échangé des messages).
router.get('/conversations', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.phone, u.country,
             (SELECT COUNT(*)::int FROM messages m2 WHERE m2.user_id = u.id AND m2.sender = 'client' AND m2.read = FALSE) AS unread,
             (SELECT m3.content FROM messages m3 WHERE m3.user_id = u.id ORDER BY m3.created_at DESC LIMIT 1) AS last_content,
             (SELECT m4.image_url FROM messages m4 WHERE m4.user_id = u.id ORDER BY m4.created_at DESC LIMIT 1) AS last_image,
             MAX(m.created_at) AS last_at
      FROM users u
      JOIN messages m ON m.user_id = u.id
      GROUP BY u.id
      ORDER BY last_at DESC
    `);
    return res.json({
      conversations: rows.map((r) => ({
        userId: r.id,
        phone: r.phone,
        country: r.country,
        unread: r.unread,
        lastContent: r.last_content,
        lastImage: r.last_image,
        lastAt: r.last_at,
      })),
    });
  } catch (err) {
    console.error('[admin:conversations]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Messages d'un utilisateur donné.
router.get('/messages', requireAdmin, async (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  if (!userId) return res.status(400).json({ error: 'userId requis.' });

  try {
    const { rows } = await pool.query(
      'SELECT id, sender, content, image_url, read, created_at FROM messages WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    // Marque les messages du client comme lus.
    await pool.query("UPDATE messages SET read = TRUE WHERE user_id = $1 AND sender = 'client'", [userId]);
    return res.json({ messages: rows.map(toMessage) });
  } catch (err) {
    console.error('[admin:messages]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Répondre à un utilisateur.
router.post('/messages', requireAdmin, async (req, res) => {
  const { userId, content, image } = req.body || {};
  const id = parseInt(userId, 10);
  if (!id) return res.status(400).json({ error: 'userId requis.' });

  const text = String(content || '').trim();
  const imageUrl = image ? saveImage(image) : null;
  if (!text && !imageUrl) return res.status(400).json({ error: 'Message vide.' });
  if (image && !imageUrl) return res.status(400).json({ error: 'Image invalide ou trop volumineuse (max 5 Mo).' });

  try {
    const { rows } = await pool.query(
      "INSERT INTO messages (user_id, sender, content, image_url) VALUES ($1, 'admin', $2, $3) RETURNING id, sender, content, image_url, read, created_at",
      [id, text || null, imageUrl]
    );
    await notifyUser(id, 'Réponse du service client', text || 'Le service client vous a envoyé une image.', 'message');
    return res.status(201).json({ message: toMessage(rows[0]) });
  } catch (err) {
    console.error('[admin:reply]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ============ Administration : utilisateurs, dépôts, retraits ============

// Statistiques globales.
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*)::int AS c FROM users');
    const wallets = await pool.query(
      'SELECT COALESCE(SUM(depot),0)::float AS depot, COALESCE(SUM(revenu),0)::float AS revenu FROM wallets'
    );
    const pw = await pool.query("SELECT COUNT(*)::int AS c FROM transactions WHERE type = 'withdrawal' AND status = 'pending'");
    const pd = await pool.query("SELECT COUNT(*)::int AS c FROM transactions WHERE type = 'deposit' AND status = 'pending'");
    return res.json({
      users: users.rows[0].c,
      depot: wallets.rows[0].depot,
      revenu: wallets.rows[0].revenu,
      pendingWithdrawals: pw.rows[0].c,
      pendingDeposits: pd.rows[0].c,
    });
  } catch (err) {
    console.error('[admin:stats]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Liste des utilisateurs (avec soldes).
router.get('/users', requireAdmin, async (req, res) => {
  const q = (req.query.q || '').trim();
  try {
    const base = `SELECT u.id, u.phone, u.country, u.is_admin, u.created_at,
                         COALESCE(w.depot,0)::float AS depot, COALESCE(w.revenu,0)::float AS revenu
                  FROM users u LEFT JOIN wallets w ON w.user_id = u.id`;
    const rows = q
      ? (await pool.query(base + ' WHERE u.phone ILIKE $1 OR u.country ILIKE $1 ORDER BY u.id DESC LIMIT 200', ['%' + q + '%'])).rows
      : (await pool.query(base + ' ORDER BY u.id DESC LIMIT 200')).rows;
    return res.json({ users: rows });
  } catch (err) {
    console.error('[admin:users]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Créditer un utilisateur (dépôt ou revenu).
router.post('/users/:id/credit', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { amount, balance, note } = req.body || {};
  const amt = Number(amount);
  if (!userId || !Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide.' });
  const col = balance === 'revenu' ? 'revenu' : 'depot';
  try {
    const w = await pool.query(
      `INSERT INTO wallets (user_id, depot, revenu) VALUES ($1, 0, 0) ON CONFLICT (user_id) DO UPDATE SET ${col} = wallets.${col} + $2, updated_at = NOW() RETURNING depot, revenu`,
      [userId, amt]
    );
    await pool.query(
      "INSERT INTO transactions (user_id, type, amount, status, reference, details) VALUES ($1, 'deposit', $2, 'success', $3, $4)",
      [userId, amt, 'ADM' + Date.now().toString(), JSON.stringify({ note: note || 'Crédit administrateur', balance: col })]
    );
    await notifyUser(userId, 'Crédit reçu', `Votre solde a été crédité de ${amt} FCFA.`, 'info');
    return res.json({ success: true, depot: Number(w.rows[0].depot), revenu: Number(w.rows[0].revenu) });
  } catch (err) {
    console.error('[admin:credit]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Débiter un utilisateur.
router.post('/users/:id/debit', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { amount, balance, note } = req.body || {};
  const amt = Number(amount);
  if (!userId || !Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide.' });
  const col = balance === 'revenu' ? 'revenu' : 'depot';
  try {
    const w = await pool.query(
      `UPDATE wallets SET ${col} = wallets.${col} - $2, updated_at = NOW() WHERE user_id = $1 AND wallets.${col} >= $2 RETURNING depot, revenu`,
      [userId, amt]
    );
    if (w.rowCount === 0) return res.status(400).json({ error: 'Solde insuffisant.' });
    await pool.query(
      "INSERT INTO transactions (user_id, type, amount, status, reference, details) VALUES ($1, 'withdrawal', $2, 'success', $3, $4)",
      [userId, amt, 'ADM' + Date.now().toString(), JSON.stringify({ note: note || 'Débit administrateur', balance: col })]
    );
    await notifyUser(userId, 'Débit effectué', `Votre solde a été débité de ${amt} FCFA.`, 'info');
    return res.json({ success: true, depot: Number(w.rows[0].depot), revenu: Number(w.rows[0].revenu) });
  } catch (err) {
    console.error('[admin:debit]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Promouvoir / rétrograder un utilisateur administrateur.
router.post('/users/:id/toggle-admin', requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const target = !!(req.body || {}).isAdmin;
  if (!userId) return res.status(400).json({ error: 'ID invalide.' });
  try {
    await pool.query('UPDATE users SET is_admin = $2 WHERE id = $1', [userId, target]);
    return res.json({ success: true, isAdmin: target });
  } catch (err) {
    console.error('[admin:toggle-admin]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Liste des transactions (dépôts / retraits) avec le numéro de l'utilisateur.
router.get('/transactions', requireAdmin, async (req, res) => {
  const type = req.query.type;
  const status = req.query.status;
  const cond = [];
  const params = [];
  if (type && type !== 'all') { params.push(type); cond.push(`t.type = $${params.length}`); }
  if (status && status !== 'all') { params.push(status); cond.push(`t.status = $${params.length}`); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  try {
    const rows = (await pool.query(
      `SELECT t.id, t.user_id, t.type, t.amount::float, t.status, t.reference, t.details, t.created_at, u.phone, u.country
       FROM transactions t JOIN users u ON u.id = t.user_id
       ${where} ORDER BY t.created_at DESC LIMIT 200`,
      params
    )).rows;
    return res.json({ transactions: rows });
  } catch (err) {
    console.error('[admin:transactions]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Approuver une transaction en attente (dépôt ou retrait).
router.post('/transactions/:id/approve', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const tx = (await pool.query('SELECT * FROM transactions WHERE id = $1', [id])).rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable.' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction déjà traitée.' });
    if (tx.type === 'deposit') {
      await pool.query(
        'INSERT INTO wallets (user_id, depot, revenu) VALUES ($1, $2, 0) ON CONFLICT (user_id) DO UPDATE SET depot = wallets.depot + $2, updated_at = NOW()',
        [tx.user_id, tx.amount]
      );
    }
    await pool.query("UPDATE transactions SET status = 'success' WHERE id = $1", [id]);
    await notifyUser(tx.user_id, 'Opération approuvée', `Votre ${tx.type === 'deposit' ? 'dépôt' : 'retrait'} de ${Number(tx.amount)} FCFA a été validé.`, 'info');
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin:approve]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Rejeter une transaction en attente.
router.post('/transactions/:id/reject', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const tx = (await pool.query('SELECT * FROM transactions WHERE id = $1', [id])).rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable.' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction déjà traitée.' });
    if (tx.type === 'withdrawal') {
      await pool.query('UPDATE wallets SET revenu = wallets.revenu + $2, updated_at = NOW() WHERE user_id = $1', [tx.user_id, tx.amount]);
    }
    await pool.query("UPDATE transactions SET status = 'refused' WHERE id = $1", [id]);
    await notifyUser(tx.user_id, 'Opération refusée', `Votre ${tx.type === 'deposit' ? 'dépôt' : 'retrait'} de ${Number(tx.amount)} FCFA a été refusé.`, 'info');
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin:reject]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;