const { pool } = require('./src/db');

(async () => {
  const r = await pool.query("DELETE FROM notifications WHERE message = 'Test notification'");
  console.log('Notifs de test supprimées:', r.rowCount);
  await pool.end();
})();
