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
  const invitationCode = 'WHEELTEST';

  await pool.query('DELETE FROM users WHERE phone = $1', [phone]);

  try {
    let r = await req('/api/auth/register', { method: 'POST', body: JSON.stringify({ country, phone, password, confirmPassword: password, invitationCode, termsAccepted: true }) });
    r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ country, phone, password }) });
    const cookie = r.cookie;
    const uid = (await pool.query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0].id;

    r = await req('/api/wheel', {}, cookie);
    console.log('status avant:', r.status, JSON.stringify(r.body));

    r = await req('/api/wheel/spin', { method: 'POST' }, cookie);
    console.log('spin 1:', r.status, JSON.stringify(r.body));

    const w = (await pool.query('SELECT depot FROM wallets WHERE user_id = $1', [uid])).rows[0];
    console.log('depot après spin:', w.depot);

    r = await req('/api/wheel/spin', { method: 'POST' }, cookie);
    console.log('spin 2 (double):', r.status, JSON.stringify(r.body));

    r = await req('/api/wheel', {}, cookie);
    console.log('status après:', r.status, JSON.stringify(r.body));

    console.log('TEST ROUE TERMINE');
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    await pool.end();
  }
})();
