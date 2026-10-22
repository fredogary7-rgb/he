const { pool } = require('./src/db');

(async () => {
  try {
    const r = await pool.query(
      "UPDATE users SET is_admin = TRUE WHERE phone = '71339325' RETURNING id, country, phone, is_admin"
    );
    console.log('Compte(s) passé(s) administrateur :', JSON.stringify(r.rows));
    if (r.rowCount === 0) console.log('>>> Aucun utilisateur trouvé avec ce numéro.');
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
