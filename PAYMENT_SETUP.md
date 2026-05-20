# Paiements Mixx / Flooz

Ce projet est prepare pour un flux de paiement serveur Mixx/Flooz :

1. le frontend demande l'initialisation du paiement
2. le backend cree une transaction locale
3. le backend appelle le fournisseur Mixx ou Flooz avec les identifiants marchands configures
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

Les routes webhook recommandees sont :

- Mixx : `POST /payments/webhook/mixx`
- Flooz : `POST /payments/webhook/flooz`

Si `ADSL2EF_PAYMENT_WEBHOOK_SECRET` est configure, le fournisseur ou votre passerelle doit envoyer :

- `x-webhook-secret: <votre-secret>`

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
- renseigner les variables `ADSL2EF_MIXX_*` et `ADSL2EF_FLOOZ_*` sur Railway ou votre serveur
- tester les webhooks sur un domaine HTTPS public

Le backend accepte deja les providers `mixx` et `flooz`, cree une transaction locale, appelle l'URL marchand configuree, stocke la reference fournisseur, puis active le cours uniquement quand le statut devient `approved`.
