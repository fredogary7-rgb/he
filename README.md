# KOUZ HOUS

Plateforme d'investissement en **FCFA** avec paiement **Mobile Money** (Togo, Bénin, Côte d'Ivoire, Cameroun, Burkina Faso, Mali).

## Stack technique

- **Backend** : Node.js + Express
- **Base de données** : PostgreSQL (Neon)
- **Sessions** : `express-session`
- **Mots de passe** : hashés avec `bcryptjs`
- **Frontend** : HTML / CSS / JavaScript (pages statiques + animations)

## Structure du projet

```
he/
├── assets/
│   └── images/                # Images du catalogue (casque, motos, vélo, etc.)
├── public/                    # Frontend servi par Express
│   ├── css/style.css          # Styles + animations (Ken Burns, fade, etc.)
│   ├── js/
│   │   ├── common.js          # Helpers partagés (pays, slideshow, mot de passe)
│   │   ├── register.js        # Logique du formulaire d'inscription
│   │   ├── login.js           # Logique du formulaire de connexion
│   │   └── dashboard.js       # Tableau de bord (après connexion)
│   ├── index.html             # Page d'accueil
│   ├── register.html          # Page d'inscription
│   ├── login.html             # Page de connexion
│   └── dashboard.html         # Tableau de bord
├── src/
│   ├── config.js              # Variables d'environnement
│   ├── db.js                  # Connexion PostgreSQL + création du schéma
│   ├── countries.js           # Liste des 6 pays pris en charge
│   ├── routes/auth.js         # Endpoints d'authentification
│   └── server.js              # Point d'entrée Express
├── .env                       # Configuration (NE PAS COMMITER)
├── .env.example               # Modèle de configuration
├── package.json
└── README.md
```

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env` à la racine (copiez `.env.example`) :

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST/DB_NAME
SESSION_SECRET=une-longue-chaine-aleatoire
PORT=3000
```

## Lancement

```bash
# Production
npm start

# Développement (redémarrage automatique)
npm run dev
```

Le serveur démarre sur `http://localhost:3000`.

## Pages

| URL            | Description                         |
|----------------|-------------------------------------|
| `/`            | Accueil (landing)                   |
| `/register`    | Inscription                         |
| `/login`       | Connexion                           |
| `/dashboard`   | Tableau de bord (session requise)   |

## API d'authentification

### `POST /api/auth/register`

```json
{
  "country": "Togo",
  "phone": "90123456",
  "password": "secret123",
  "confirmPassword": "secret123",
  "invitationCode": "KH-2024",
  "termsAccepted": true
}
```

### `POST /api/auth/login`

```json
{
  "country": "Togo",
  "phone": "90123456",
  "password": "secret123",
  "rememberMe": true
}
```

### `GET /api/auth/me`
Renvoie l'utilisateur connecté (ou `401` si non authentifié).

### `POST /api/auth/logout`
Déconnecte l'utilisateur.

## Base de données

La table `users` est créée automatiquement au démarrage :

```sql
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  country         VARCHAR(60)  NOT NULL,
  phone           VARCHAR(30)  NOT NULL,
  password_hash   TEXT         NOT NULL,
  invitation_code VARCHAR(60)  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (country, phone)
);
```

## Remarques

- Les mots de passe sont **hashés** (bcrypt) — jamais stockés en clair.
- `Se souvenir de moi` prolonge la session à 30 jours (sinon, session navigateur).
- Le store de session est en mémoire pour le développement ; pour la production, utiliser un store persistant (`connect-pg-simple`, Redis, etc.).
- Passer `cookie.secure = true` dans `src/server.js` une fois le site servi en HTTPS.
