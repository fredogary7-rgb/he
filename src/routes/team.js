const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Taux de commissions de parrainage (règles métier configurées).
const REFERRAL_LEVELS = [
  { level: 1, rate: 10, label: 'Filleuls directs' },
  { level: 2, rate: 3, label: 'Filleuls de vos filleuls' },
  { level: 3, rate: 1, label: 'Troisième génération' },
];

// Middleware : seul un utilisateur connecté peut consulter son équipe.
router.use((req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }
  next();
});

// Renvoie le lien de parrainage, les statistiques et la liste des membres de l'équipe.
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;

    // 1. Code de parrainage de l'utilisateur
    const me = await pool.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
    if (me.rowCount === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }
    const referralCode = me.rows[0].referral_code;

    // 2. Membres de l'équipe (3 niveaux)
    const team = await pool.query(
      `WITH RECURSIVE team AS (
         SELECT id, phone, country, created_at, 1 AS level
         FROM users
         WHERE referred_by = $1
         UNION ALL
         SELECT u.id, u.phone, u.country, u.created_at, t.level + 1
         FROM users u
         JOIN team t ON u.referred_by = t.id
         WHERE t.level < 3
       )
       SELECT id, phone, country, created_at, level FROM team
       ORDER BY level ASC, created_at DESC`,
      [userId]
    );

    const members = team.rows.map((m) => ({
      id: m.id,
      phone: m.phone,
      country: m.country,
      level: m.level,
      createdAt: m.created_at,
    }));
    const directReferrals = members.filter((m) => m.level === 1);

    // 3. Membres actifs (ayant effectué un dépôt)
    let activeMembers = 0;
    if (members.length > 0) {
      const ids = members.map((m) => m.id);
      const active = await pool.query(
        'SELECT COUNT(*)::int AS count FROM wallets WHERE user_id = ANY($1::int[]) AND depot > 0',
        [ids]
      );
      activeMembers = active.rows[0].count;
    }

    // 4. Commissions générées (revenu du portefeuille de l'utilisateur)
    await pool.query(
      'INSERT INTO wallets (user_id, depot, revenu) VALUES ($1, 0, 0) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );
    const wallet = await pool.query('SELECT revenu FROM wallets WHERE user_id = $1', [userId]);
    const commissions = Number(wallet.rows[0].revenu);

    return res.json({
      referralCode,
      referralLink: `/register?code=${encodeURIComponent(referralCode)}`,
      stats: {
        teamMembers: members.length,
        directReferrals: directReferrals.length,
        activeMembers,
        commissions,
      },
      levels: REFERRAL_LEVELS,
      members,
    });
  } catch (err) {
    console.error('[team]', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;