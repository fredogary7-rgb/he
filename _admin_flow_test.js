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
  const invitationCode = 'ADMINTEST';

  await pool.query('DELETE FROM users WHERE phone = $1', [phone]);

  try {
    let r = await req('/api/auth/register', { method: 'POST', body: JSON.stringify({ country, phone, password, confirmPassword: password, invitationCode, termsAccepted: true }) });
    const uid = (await pool.query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0].id;
    await pool.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [uid]);

    r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ country, phone, password }) });
    const cookie = r.cookie;
    console.log('login:', r.status);

    r = await req('/api/admin/status', {}, cookie);
    console.log('admin status (compte is_admin):', r.status, JSON.stringify(r.body));

    r = await req('/api/admin/conversations', {}, cookie);
    console.log('admin conversations:', r.status);

    console.log('TEST FLUX ADMIN TERMINE');
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    await pool.end();
  }
})();
