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
  const invitationCode = 'ADMTEST2';

  await pool.query('DELETE FROM users WHERE phone = $1', [phone]);

  try {
    // Admin login (password)
    let r = await req('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: 'kouz-admin-2024' }) });
    const adminCookie = r.cookie;
    console.log('admin login:', r.status);

    r = await req('/api/admin/stats', {}, adminCookie);
    console.log('stats:', r.status, JSON.stringify(r.body));

    r = await req('/api/admin/users', {}, adminCookie);
    console.log('users:', r.status, 'count=', (r.body.users || []).length);

    // Client register + login
    await req('/api/auth/register', { method: 'POST', body: JSON.stringify({ country, phone, password, confirmPassword: password, invitationCode, termsAccepted: true }) });
    r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ country, phone, password }) });
    const clientCookie = r.cookie;
    const uid = (await pool.query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0].id;

    // Client demande un dépôt
    r = await req('/api/wallet/deposit', { method: 'POST', body: JSON.stringify({ amount: 10000, phone: '90123456', country: 'Togo' }) }, clientCookie);
    console.log('demande depot:', r.status, JSON.stringify(r.body));

    // Admin voit les dépôts en attente
    r = await req('/api/admin/transactions?type=deposit&status=pending', {}, adminCookie);
    const pending = r.body.transactions || [];
    console.log('depots en attente:', r.status, 'count=', pending.length);

    // Admin approuve le premier dépôt en attente
    if (pending.length) {
      r = await req('/api/admin/transactions/' + pending[0].id + '/approve', { method: 'POST' }, adminCookie);
      console.log('approve depot:', r.status, JSON.stringify(r.body));
    }
    const w = (await pool.query('SELECT depot FROM wallets WHERE user_id = $1', [uid])).rows[0];
    console.log('depot client apres approbation:', w ? w.depot : '?', '(attendu 10000)');

    // Admin crédite directement (revenu)
    r = await req('/api/admin/users/' + uid + '/credit', { method: 'POST', body: JSON.stringify({ amount: 500, balance: 'revenu', note: 'bonus test' }) }, adminCookie);
    console.log('credit revenu:', r.status, JSON.stringify(r.body));

    // Admin débite
    r = await req('/api/admin/users/' + uid + '/debit', { method: 'POST', body: JSON.stringify({ amount: 200, balance: 'depot' }) }, adminCookie);
    console.log('debit depot:', r.status, JSON.stringify(r.body));

    console.log('TEST ADMIN TERMINE');
  } catch (e) {
    console.error('ERREUR:', e);
    process.exitCode = 1;
  } finally {
    await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
    await pool.end();
  }
})();
