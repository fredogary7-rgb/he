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

module.exports = router;