const express = require('express');
const { pool } = require('../db');
const { saveImage } = require('../uploads');
const { notifyAdmins } = require('../notify');

const router = express.Router();

// Middleware : seul un utilisateur connecté peut consulter/envoyer des messages.
router.use((req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  next();
});

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

// Messages du client (ordre chronologique).
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, sender, content, image_url, read, created_at FROM messages WHERE user_id = $1 ORDER BY created_at ASC',
      [req.session.userId]
    );
    return res.json({ messages: rows.map(toMessage) });
  } catch (err) {
    console.error('[messages]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Envoyer un message au service client (texte et/ou image).
router.post('/', async (req, res) => {
  const { content, image } = req.body || {};
  const text = String(content || '').trim();
  const imageUrl = image ? saveImage(image) : null;

  if (!text && !imageUrl) {
    return res.status(400).json({ error: 'Message vide.' });
  }
  if (image && !imageUrl) {
    return res.status(400).json({ error: 'Image invalide ou trop volumineuse (max 5 Mo).' });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO messages (user_id, sender, content, image_url) VALUES ($1, 'client', $2, $3) RETURNING id, sender, content, image_url, read, created_at",
      [req.session.userId, text || null, imageUrl]
    );
    await notifyAdmins('Nouveau message client', text || 'Le client a envoyé une image.', 'message');
    return res.status(201).json({ message: toMessage(rows[0]) });
  } catch (err) {
    console.error('[messages:send]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;