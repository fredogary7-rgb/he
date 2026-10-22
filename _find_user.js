const { pool } = require('./src/db');

(async () => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.country, u.phone,
              COALESCE((SELECT w.depot FROM wallets w WHERE w.user_id = u.id), 0) AS depot
       FROM users u
       WHERE u.phone LIKE '%71339325'
       ORDER BY u.id`
    );
    console.log('Utilisateurs trouvés:', JSON.stringify(rows, null, 2));
    if (rows.length === 0) console.log('>>> AUCUN utilisateur avec ce numéro.');
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
