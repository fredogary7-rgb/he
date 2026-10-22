const { pool } = require('./db');

// Crée une notification pour un utilisateur donné.
async function notifyUser(userId, title, message, type) {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [userId, title, message, type || 'info']
    );
  } catch (e) {
    console.error('[notify]', e);
  }
}

// Crée une notification pour tous les administrateurs.
async function notifyAdmins(title, message, type) {
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE is_admin = TRUE');
    for (const r of rows) {
      await notifyUser(r.id, title, message, type);
    }
  } catch (e) {
    console.error('[notifyAdmins]', e);
  }
}

module.exports = { notifyUser, notifyAdmins };