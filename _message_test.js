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
  const invitationCode = 'MSGTEST99';
  const ADMIN_PW = 'kouz-admin-2024';

  await pool.query('DELETE FROM users WHERE phone = $1', [phone]);

  try {
    let r = await req('/api/auth/register', { method: 'POST', body: JSON.stringify({ country, phone, password, confirmPassword: password, invitationCode, termsAccepted: true }) });
    console.log('register:', r.status);
    r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ country, phone, password }) });
    console.log('login client:', r.status);
    const clientCookie = r.cookie;
    const uid = (await pool.query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0].id;

    r = await req('/api/messages', { method: 'POST', body: JSON.stringify({ content: "Bonjour, j'ai une question" }) }, clientCookie);
    console.log('client message texte:', r.status, JSON.stringify(r.body));

    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    r = await req('/api/messages', { method: 'POST', body: JSON.stringify({ content: 'Voici une capture', image: tinyPng }) }, clientCookie);
    console.log('client message image:', r.status, JSON.stringify(r.body));

    r = await req('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'mauvais' }) });
    console.log('admin login mauvais:', r.status);
    r = await req('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: ADMIN_PW }) });
    console.log('admin login bon:', r.status);
    const adminCookie = r.cookie;

    r = await req('/api/admin/conversations', {}, adminCookie);
    console.log('conversations:', r.status, JSON.stringify(r.body.conversations));

    r = await req('/api/admin/messages?userId=' + uid, {}, adminCookie);
    console.log('admin messages:', r.status, 'count=', (r.body.messages || []).length);

    r = await req('/api/admin/messages', { method: 'POST', body: JSON.stringify({ userId: uid, content: 'Bonjour, comment puis-je vous aider ?' }) }, adminCookie);
    console.log('admin reponse:', r.status, JSON.stringify(r.body));

    r = await req('/api/messages', {}, clientCookie);
    const msgs = r.body.messages || [];
    console.log('client messages:', r.status, 'count=', msgs.length, 'dernier sender=', msgs[msgs.length - 1] && msgs[msgs.length - 1].sender);

    console.log('TESTS TERMINES');
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    await pool.end();
  }
})();
