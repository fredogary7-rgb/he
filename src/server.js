const os = require('os');
const path = require('path');
const express = require('express');
const session = require('express-session');

const { PORT, SESSION_SECRET } = require('./config');
const { initSchema, testConnection } = require('./db');
const authRouter = require('./routes/auth');
const walletRouter = require('./routes/wallet');
const teamRouter = require('./routes/team');
const historyRouter = require('./routes/history');
const notificationsRouter = require('./routes/notifications');
const productsRouter = require('./routes/products');
const messagesRouter = require('./routes/messages');
const adminRouter = require('./routes/admin');
const wheelRouter = require('./routes/wheel');

const app = express();

// ---- Middleware ----
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'kouz.sid',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // passer à `true` en production avec HTTPS
    },
  })
);

// ---- Fichiers statiques ----
app.use(express.static(path.join(__dirname, '..', 'public')));
// Les images du catalogue sont servies sous /images/...
app.use('/images', express.static(path.join(__dirname, '..', 'assets', 'images')));
// Les images envoyées dans la messagerie.
app.use('/uploads', express.static(path.join(__dirname, '..', 'assets', 'uploads')));

// ---- API ----
app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/team', teamRouter);
app.use('/api/history', historyRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/products', productsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/wheel', wheelRouter);

// ---- Pages ----
const sendPage = (file) => (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', file));

app.get('/', sendPage('index.html'));
app.get('/register', sendPage('register.html'));
app.get('/login', sendPage('login.html'));
app.get('/dashboard', sendPage('dashboard.html'));
app.get('/faq', sendPage('faq.html'));
app.get('/conditions', sendPage('conditions.html'));
app.get('/a-propos', sendPage('a-propos.html'));
app.get('/espace-client', sendPage('espace-client.html'));
app.get('/espace-admin', sendPage('espace-admin.html'));
app.get('/vip', sendPage('vip.html'));
app.get('/depot', sendPage('depot.html'));
app.get('/admin', sendPage('admin.html'));

// ---- 404 API ----
app.use('/api', (req, res) => res.status(404).json({ error: 'Route API introuvable.' }));

// Liste les adresses IPv4 locales pour un accès depuis le réseau (ex. iPhone).
function listLanUrls(port) {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

// ---- Démarrage ----
(async () => {
  try {
    const now = await testConnection();
    console.log(`✔ Connexion PostgreSQL réussie (${now})`);
    await initSchema();
    console.log('✔ Schéma de base de données prêt.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log('✔ Serveur KOUZ HOUS démarré :');
      console.log(`   - Local  : http://localhost:${PORT}`);
      listLanUrls(PORT).forEach((u) => console.log(`   - Réseau : ${u}`));
    });
  } catch (err) {
    console.error('✖ Échec de la connexion à la base de données :', err.message);
    process.exit(1);
  }
})();
