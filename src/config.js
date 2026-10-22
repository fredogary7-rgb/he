// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET || 'kouz-hous-dev-secret-change-me',
  // Durée de vie du cookie "Se souvenir de moi" : 30 jours
  REMEMBER_ME_MAX_AGE: 30 * 24 * 60 * 60 * 1000,
  // Mot de passe de l'espace administrateur (à changer en production)
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'kouz-admin-2024',
};
