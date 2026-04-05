# ADSL-2EF

Plateforme numerique de formation, de suivi pedagogique et d'administration pour ADSL-2EF.

## Fonctionnalites deja en place

- Authentification avec profils `apprenant`, `enseignant` et `administrateur`
- Tableaux de bord adaptes selon le profil
- Gestion des cours, modules, lecons et ressources
- Quiz, devoirs, soumissions et correction
- Messages, annonces, forums et assiduite
- Parametres du site, catalogue public, contact et paiement
- Export CSV du carnet de notes
- Journal d'audit et outils d'administration

## Persistance des donnees

La plateforme fonctionne actuellement avec trois modes de persistance configurables dans les parametres du site :

- `local` : stockage local navigateur pour le fonctionnement immediat
- `jsonbin` : synchronisation distante du catalogue et des activites
- `api` : synchronisation du snapshot complet de la plateforme avec un backend
- `supabase` : configuration preparee pour la base LMS cible

## Supabase

Le projet contient maintenant une base de travail Supabase :

- `SUPABASE_SETUP.md`
- `supabase/schema.sql`
- `supabase/storage.sql`

Cette passe prepare :

- le schema LMS
- les reglages Supabase dans `Parametres du site`
- le bucket de fichiers
- la lecture/ecriture des profils, cours, modules, lecons, ressources, inscriptions, activites, soumissions et achevements

La prochaine etape sera de connecter le frontend aux vraies tables Supabase.

## Mode API

Le mode `API backend` est prepare dans l'interface d'administration.

Renseignez :

- `Base URL API`
- `Route test backend`
- `Chemin snapshot`
- `Route session courante`
- `Route résumé`
- `Route événements`
- `Route connexion`
- `Route inscription`
- `Route paiement`
- `Route statut paiement`
- `Route evenements metier`
- `Jeton API`

Le frontend peut :

- lire l'etat complet de la plateforme
- synchroniser le snapshot global
- connecter un utilisateur
- inscrire un utilisateur
- initialiser un paiement
- verifier le statut d'un paiement
- publier des evenements metier

## Documentation backend

Le contrat attendu par le frontend est detaille dans :

- `BACKEND_API.md`
- `PAYMENT_SETUP.md`

## Demarrage du backend local

Le projet contient maintenant un backend Node natif dans :

- `backend/server.js`
- `backend/.env.example`

Commandes :

1. `npm run check:api`
2. `npm run start:api`

Le backend demarre par defaut sur :

- `http://localhost:3000`

Routes incluses :

- `GET /health`
- `GET /auth/me`
- `GET /lms/state`
- `GET /lms/summary`
- `GET /lms/events`
- `PUT /lms/state`
- `POST /auth/login`
- `POST /auth/register`
- `POST /payments/init`
- `GET /payments/status`
- `POST /payments/confirm`
- `POST /payments/webhook/:provider`
- `POST /lms/events`

## Deploiement

1. Deposez le dossier sur Netlify.
2. Utilisez la racine du projet comme repertoire de publication.
3. Aucun build n'est necessaire pour cette version.

## Paiements Mixx / Flooz

Le frontend n'accorde plus automatiquement l'acces au cours apres clic sur `Payer`.

Le flux recommande est maintenant :

1. `POST /payments/init`
2. redirection vers le lien de paiement renvoye par le backend
3. webhook fournisseur ou confirmation serveur
4. `GET /payments/status`
5. activation du cours uniquement quand le statut devient `approved`

Consultez `PAYMENT_SETUP.md` pour les variables d'environnement et la mise en place des adaptateurs marchands.
