const { pool } = require('./src/db');

const BASE = 'http://localhost:3000';

async function req(url, opts, cookie) {
  const headers = {};
  if (opts && opts.body) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + url, { ...(opts || {}), headers });
  const setCookie = res.headers.get('set-cookie');
  let body = null;
  try { body = await res.json(); } catch (e) {}
  return { status: res.status, body, cookie: setCookie ? setCookie.split(';')[0] : null };
}

(async () => {
  const country = 'Togo';
  const phone = '90' + Math.floor(1000000 + Math.random() * 9000000);
  const password = 'test1234';
  const invitationCode = 'BUYTEST99';

  await pool.query('DELETE FROM users WHERE phone = $1', [phone]);

  try {
    let r = await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ country, phone, password, confirmPassword: password, invitationCode, termsAccepted: true }),
    });
    console.log('register:', r.status, JSON.stringify(r.body));

    r = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ country, phone, password }),
    });
    console.log('login:', r.status);
    const cookie = r.cookie;
    if (!cookie) throw new Error('Pas de cookie de session');

    const uid = (await pool.query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0].id;
    await pool.query('INSERT INTO wallets (user_id, depot, revenu) VALUES ($1, 50000, 0) ON CONFLICT (user_id) DO UPDATE SET depot = 50000', [uid]);
    console.log('solde depot initial: 50000');

    r = await req('/api/products/1/buy', { method: 'POST' }, cookie);
    console.log('buy produit 1:', r.status, JSON.stringify(r.body));

    const w1 = (await pool.query('SELECT depot FROM wallets WHERE user_id = $1', [uid])).rows[0];
    console.log('depot après achat:', w1.depot, '(attendu 42000)');

    const txs = (await pool.query("SELECT type, amount, status FROM transactions WHERE user_id = $1 AND type = 'purchase'", [uid])).rows;
    console.log('transactions purchase:', JSON.stringify(txs));

    r = await req('/api/products/7/buy', { method: 'POST' }, cookie);
    console.log('buy produit 7 (insuffisant):', r.status, JSON.stringify(r.body));

    const w2 = (await pool.query('SELECT depot FROM wallets WHERE user_id = $1', [uid])).rows[0];
    console.log('depot après échec:', w2.depot, '(attendu 42000, inchangé)');

    const ok = Number(w1.depot) === 42000;
    const failOk = Number(w2.depot) === 42000;
    const failStatus = r.status === 400;
    console.log(ok && failOk && failStatus ? 'RESULTAT: OK' : 'RESULTAT: ECHEC');
  } catch (e) {
    console.error('ERREUR TEST:', e);
    process.exitCode = 1;
  } finally {
    await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    await pool.end();
  }
})();
