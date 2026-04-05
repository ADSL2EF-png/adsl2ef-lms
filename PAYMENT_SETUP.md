# Paiements Mixx / Flooz

Ce projet est maintenant prepare pour un flux de paiement serveur plus propre :

1. le frontend demande l'initialisation du paiement
2. le backend cree une transaction locale
3. le backend appelle le fournisseur Mixx ou Flooz
4. le frontend redirige l'utilisateur vers le lien de paiement
5. le backend confirme ensuite le paiement via webhook ou confirmation interne
6. le cours n'est ouvert qu'apres statut `approved`

## Variables d'environnement backend

Configurez dans votre serveur :

- `ADSL2EF_API_TOKEN`
- `ADSL2EF_PAYMENT_WEBHOOK_SECRET`

Pour Mixx :

- `ADSL2EF_MIXX_INIT_URL`
- `ADSL2EF_MIXX_API_KEY`
- `ADSL2EF_MIXX_MERCHANT_ID`
- `ADSL2EF_MIXX_CALLBACK_URL`
- `ADSL2EF_MIXX_RETURN_URL`
- `ADSL2EF_MIXX_CANCEL_URL`

Pour Flooz :

- `ADSL2EF_FLOOZ_INIT_URL`
- `ADSL2EF_FLOOZ_API_KEY`
- `ADSL2EF_FLOOZ_MERCHANT_ID`
- `ADSL2EF_FLOOZ_CALLBACK_URL`
- `ADSL2EF_FLOOZ_RETURN_URL`
- `ADSL2EF_FLOOZ_CANCEL_URL`

## Routes backend

- `POST /payments/init`
- `GET /payments/status?paymentId=...`
- `POST /payments/confirm`
- `POST /payments/webhook/:provider`

## Important

Les API publiques Mixx/Flooz ne sont generalement pas documentees de maniere ouverte pour tous les marchands.

En pratique, pour une activation reelle, il faut :

- obtenir vos identifiants marchands officiels
- obtenir les URLs et formats de payload fournis par l'operateur
- brancher ou ajuster l'adaptateur backend selon cette documentation marchande
- tester les webhooks sur un domaine HTTPS public

Le backend de ce projet est donc maintenant `pret pour integration`, mais la mise en production reelle demande encore les acces officiels fournis par Mixx et Flooz.
