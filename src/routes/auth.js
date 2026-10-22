const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, generateReferralCode } = require('../db');
const { COUNTRIES, COUNTRY_NAMES } = require('../countries');
const { REMEMBER_ME_MAX_AGE } = require('../config');

const router = express.Router();

// Normalise un numéro de téléphone : retire espaces, tirets, points, parenthèses.
function normalizePhone(phone) {
  return String(phone || '').replace(/[\s\-().]/g, '');
}

// Accepte un numéro avec ou sans indicatif (+228, 00228, etc.), 8 à 15 chiffres.
function isValidPhone(phone) {
  return /^\+?\d{8,15}$/.test(phone);
}

// ---- Inscription ----
router.post('/register', async (req, res) => {
  try {
    const { country, phone, password, confirmPassword, invitationCode, termsAccepted } =
      req.body || {};

    // Validation
    if (!COUNTRY_NAMES.includes(country)) {
      return res.status(400).json({ error: 'Pays invalide.' });
    }
    const p = normalizePhone(phone);
    if (!isValidPhone(p)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 6 caractères.',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' });
    }
    if (!invitationCode || !invitationCode.trim()) {
      return res.status(400).json({ error: "Le code d'invitation est requis." });
    }
    if (!termsAccepted) {
      return res.status(400).json({ error: "Vous devez accepter les conditions d'utilisation." });
    }

    // Vérifier si un compte existe déjà (même pays + numéro)
    const existing = await pool.query(
      'SELECT id FROM users WHERE country = $1 AND phone = $2',
      [country, p]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({
        error: 'Un compte existe déjà avec ce numéro pour ce pays.',
      });
    }

    // Créer le compte (avec code de parrainage + lien éventuel vers le parrain)
    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = generateReferralCode();
    const inviter = await pool.query(
      'SELECT id FROM users WHERE referral_code = $1',
      [invitationCode.trim().toUpperCase()]
    );
    const referredBy = inviter.rowCount > 0 ? inviter.rows[0].id : null;

    await pool.query(
      `INSERT INTO users (country, phone, password_hash, invitation_code, referral_code, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [country, p, passwordHash, invitationCode.trim(), referralCode, referredBy]
    );

    // Notifier le parrain si l'utilisateur a été invité via un lien de parrainage.
    if (referredBy) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [referredBy, 'Nouveau filleul', `Un nouveau membre (${p}) a rejoint votre équipe.`, 'team']
      );
    }

    return res.status(201).json({
      message: 'Inscription réussie. Vous pouvez maintenant vous connecter.',
    });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
  }
});

// ---- Connexion ----
router.post('/login', async (req, res) => {
  try {
    const { country, phone, password, rememberMe } = req.body || {};

    if (!COUNTRY_NAMES.includes(country)) {
      return res.status(400).json({ error: 'Pays invalide.' });
    }
    const p = normalizePhone(phone);
    if (!isValidPhone(p)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis.' });
    }

    const result = await pool.query(
      'SELECT id, password_hash, is_admin FROM users WHERE country = $1 AND phone = $2',
      [country, p]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Numéro ou mot de passe incorrect.' });
    }

    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Numéro ou mot de passe incorrect.' });
    }

    // Créer la session
    req.session.userId = user.id;
    req.session.country = country;
    req.session.phone = p;
    req.session.isAdmin = !!user.is_admin;

    // "Se souvenir de moi" : cookie persistant 30 jours, sinon session navigateur.
    if (rememberMe) {
      req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE;
    }

    return res.json({ message: 'Connexion réussie.' });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
  }
});

// ---- Déconnexion ----
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Déconnexion réussie.' });
  });
});

// ---- Utilisateur connecté ----
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      userId: req.session.userId,
      country: req.session.country,
      phone: req.session.phone,
      isAdmin: !!req.session.isAdmin,
      countries: COUNTRIES,
    });
  }
  return res.status(401).json({ authenticated: false });
});

module.exports = router;
