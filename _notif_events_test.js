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
  const invitationCode = 'NOTIFTEST';

  await pool.query('DELETE FROM users WHERE phone = $1', [phone]);

  try {
    let r = await req('/api/auth/register', { method: 'POST', body: JSON.stringify({ country, phone, password, confirmPassword: password, invitationCode, termsAccepted: true }) });
    r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ country, phone, password }) });
    const clientCookie = r.cookie;
    const clientId = (await pool.query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0].id;
    const adminId = (await pool.query("SELECT id FROM users WHERE phone = '71339325'")).rows[0].id;

    r = await req('/api/messages', { method: 'POST', body: JSON.stringify({ content: 'Test notification' }) }, clientCookie);
    console.log('client message:', r.status);

    const notifAdmin = (await pool.query('SELECT title, message FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 5', [adminId])).rows;
    console.log('notifications admin (71339325):', JSON.stringify(notifAdmin));

    r = await req('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'kouz-admin-2024' }) });
    const adminCookie = r.cookie;
    r = await req('/api/admin/messages', { method: 'POST', body: JSON.stringify({ userId: clientId, content: 'Réponse test' }) }, adminCookie);
    console.log('admin reponse:', r.status);

    const notifClient = (await pool.query('SELECT title, message FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 5', [clientId])).rows;
    console.log('notifications client:', JSON.stringify(notifClient));

    console.log('TEST NOTIFICATIONS TERMINE');
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    await pool.end();
  }
})();
