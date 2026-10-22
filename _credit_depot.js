const { pool } = require('./src/db');

(async () => {
  const userId = 2;
  const amount = 100000;
  try {
    const before = (await pool.query('SELECT depot FROM wallets WHERE user_id = $1', [userId])).rows[0];
    const beforeDepot = before ? Number(before.depot) : 0;

    const r = await pool.query(
      `INSERT INTO wallets (user_id, depot, revenu) VALUES ($1, $2, 0)
       ON CONFLICT (user_id) DO UPDATE SET depot = wallets.depot + $2, updated_at = NOW()
       RETURNING depot`,
      [userId, amount]
    );

    const reference = 'CRED' + Date.now().toString() + Math.floor(Math.random() * 1000);
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, reference) VALUES ($1, 'deposit', $2, 'success', $3)`,
      [userId, amount, reference]
    );

    console.log('Solde depot AVANT :', beforeDepot);
    console.log('Solde depot APRÈS :', Number(r.rows[0].depot));
    console.log('Transaction deposit :', reference);
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
