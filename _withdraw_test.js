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
  const invitationCode = 'WDTEST99';

  await pool.query('DELETE FROM users WHERE phone = $1', [phone]);

  try {
    let r = await req('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ country, phone, password, confirmPassword: password, invitationCode, termsAccepted: true }),
    });
    console.log('register:', r.status);

    r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ country, phone, password }) });
    console.log('login:', r.status);
    const cookie = r.cookie;

    const uid = (await pool.query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0].id;
    await pool.query('INSERT INTO wallets (user_id, depot, revenu) VALUES ($1, 0, 50000) ON CONFLICT (user_id) DO UPDATE SET revenu = 50000', [uid]);
    console.log('revenu initial: 50000');

    r = await req('/api/wallet/services', {}, cookie);
    console.log('services:', r.status, 'rules=', JSON.stringify(r.body.rules), 'Togo=', JSON.stringify(r.body.services['Togo']));

    r = await req('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount: 10000, country: 'Togo', service: 'flooz', phone: '90123456' }) }, cookie);
    console.log('retrait 10000 (flooz):', r.status, JSON.stringify(r.body));

    const w = (await pool.query('SELECT revenu FROM wallets WHERE user_id = $1', [uid])).rows[0];
    console.log('revenu après retrait:', w.revenu, '(attendu 40000)');

    const tx = (await pool.query("SELECT type, amount, status, details FROM transactions WHERE user_id = $1 AND type = 'withdrawal'", [uid])).rows;
    console.log('transaction withdrawal:', JSON.stringify(tx));

    r = await req('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount: 99999, country: 'Togo', service: 'flooz', phone: '90123456' }) }, cookie);
    console.log('retrait > solde:', r.status, JSON.stringify(r.body));

    r = await req('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount: 5000, country: 'Togo', service: 'mtn', phone: '90123456' }) }, cookie);
    console.log('service invalide (mtn pour Togo):', r.status, JSON.stringify(r.body));

    r = await req('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount: 100, country: 'Togo', service: 'flooz', phone: '90123456' }) }, cookie);
    console.log('montant < min:', r.status, JSON.stringify(r.body));

    r = await req('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount: 5000, country: 'Togo', service: 'flooz', phone: '123' }) }, cookie);
    console.log('numéro invalide:', r.status, JSON.stringify(r.body));

    console.log('TESTS TERMINES');
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    await pool.end();
  }
})();
