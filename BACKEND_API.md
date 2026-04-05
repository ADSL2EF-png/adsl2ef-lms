# Contrat Backend ADSL-2EF

Ce document decrit le backend attendu par le frontend actuel.

## Objectif

Le frontend ADSL-2EF peut fonctionner en mode local, JSONBin ou API.

En mode `api`, le backend doit fournir :

- un point de test
- un endpoint de snapshot global
- une route de session courante
- une route de résumé
- une route de lecture des événements
- une route de connexion
- une route d'inscription
- une route d'initialisation de paiement
- une route de remontée des evenements metier

## Authentification

Le frontend envoie un header :

- `Authorization: Bearer <token>`

Le token peut venir :

- du champ `Jeton API` configure dans les parametres du site
- ou du token renvoye par la route de connexion

## Routes minimales

### 1. Test backend

- Methode : `GET`
- Route par defaut : `/health`

Reponse acceptable :

```json
{
  "status": "ok"
}
```

### 2. Snapshot global

- Methode : `GET`
- Route par defaut : `/lms/state`

Reponses acceptees :

```json
{
  "payload": {
    "config": {},
    "users": [],
    "courses": [],
    "activities": []
  }
}
```

ou :

```json
{
  "data": {
    "config": {},
    "users": [],
    "courses": [],
    "activities": []
  }
}
```

ou directement l'objet d'etat.

### 3. Synchronisation snapshot

- Methode : `PUT`
- Route par defaut : `/lms/state`

Payload envoye :

```json
{
  "source": "adsl2ef-platform",
  "exportedAt": "2026-03-24T00:00:00.000Z",
  "payload": {
    "config": {},
    "users": [],
    "courses": [],
    "activities": [],
    "questionBank": [],
    "submissions": [],
    "attendanceSessions": [],
    "notifications": [],
    "activityLog": [],
    "announcements": [],
    "messages": [],
    "forumThreads": [],
    "currentUserId": null,
    "session": {},
    "ui": {}
  }
}
```

### 4. Connexion

- Methode : `POST`
- Route par defaut : `/auth/login`

Payload envoye :

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Reponse attendue :

```json
{
  "accessToken": "jwt-or-token",
  "user": {
    "id": "usr_123",
    "name": "Nom Prenom",
    "email": "user@example.com",
    "role": "student",
    "bio": "",
    "avatar": "NP",
    "createdAt": "2026-03-24T00:00:00.000Z"
  }
}
```

### 5. Inscription

- Methode : `POST`
- Route par defaut : `/auth/register`

Payload envoye :

```json
{
  "name": "Nom Prenom",
  "email": "user@example.com",
  "password": "secret",
  "role": "student"
}
```

Reponse attendue :

```json
{
  "accessToken": "jwt-or-token",
  "user": {
    "id": "usr_456",
    "name": "Nom Prenom",
    "email": "user@example.com",
    "role": "student",
    "bio": "",
    "avatar": "NP",
    "createdAt": "2026-03-24T00:00:00.000Z"
  }
}
```

### 6. Paiement - initialisation

- Methode : `POST`
- Route par defaut : `/payments/init`

Payload envoye :

```json
{
  "provider": "mixx",
  "courseId": "course_1",
  "userId": "usr_123",
  "amount": 15000,
  "headline": "Collège - Mathématiques et Sciences"
}
```

Reponse utile :

```json
{
  "paymentId": "pay_123",
  "status": "pending",
  "provider": "mixx",
  "merchantReference": "mixx-1711974000-course",
  "providerReference": "txn_456",
  "paymentUrl": "https://paiement.exemple.com/session/pay_123"
}
```

`paymentUrl` est optionnel mais supporte par le frontend.

### 7. Paiement - statut

- Methode : `GET`
- Route par defaut : `/payments/status?paymentId=pay_123`

Reponse utile :

```json
{
  "paymentId": "pay_123",
  "status": "approved",
  "provider": "mixx",
  "courseId": "course_1",
  "userId": "usr_123",
  "amount": 15000,
  "currency": "XOF",
  "paymentUrl": "https://paiement.exemple.com/session/pay_123",
  "confirmedAt": "2026-04-01T10:30:00.000Z"
}
```

Quand `status = approved`, le frontend ouvre ensuite l'acces au cours.

### 8. Paiement - confirmation serveur

- Methode : `POST`
- Route par defaut : `/payments/confirm`

Payload envoye :

```json
{
  "paymentId": "pay_123",
  "status": "approved",
  "providerReference": "txn_456"
}
```

Cette route sert pour une confirmation interne, un back-office ou une fonction serveur.

### 9. Paiement - webhook fournisseur

- Methode : `POST`
- Route conseillee : `/payments/webhook/:provider`

Le backend peut exiger :

- `x-webhook-secret: <secret>`

Le body exact depend du fournisseur Mixx/Flooz, mais il doit au minimum permettre de retrouver :

- la reference marchande
- l'identifiant du paiement
- le statut final

### 10. Evenements metier

- Methode : `POST`
- Route par defaut : `/lms/events`

Payload envoye :

```json
{
  "type": "course.created",
  "emittedAt": "2026-03-24T00:00:00.000Z",
  "actorId": "usr_admin",
  "payload": {
    "course": {}
  }
}
```

## Types d'evenements deja emises par le frontend

- `course.created`
- `course.updated`
- `course.archived`
- `course.restored`
- `activity.created`
- `activity.updated`
- `module.created`
- `module.updated`
- `module.deleted`
- `lesson.created`
- `lesson.updated`
- `lesson.deleted`
- `announcement.created`
- `message.created`
- `forum.thread.created`
- `forum.post.created`
- `attendance.created`
- `quiz.submitted`
- `assignment.submitted`
- `submission.reviewed`
- `user.created`
- `user.updated`
- `user.deleted`

## Reponses serveur supportees apres evenement

Le frontend peut reinjecter une entite renvoyee par le backend si elle est presente dans la reponse.

Exemples acceptes :

```json
{
  "course": {
    "id": "srv_course_1",
    "title": "Cours officiel"
  }
}
```

```json
{
  "payload": {
    "activity": {
      "id": "srv_activity_1"
    }
  }
}
```

```json
{
  "data": {
    "submission": {
      "id": "srv_sub_1",
      "status": "graded"
    }
  }
}
```

Entites supportees :

- `course`
- `activity`
- `module`
- `lesson`
- `announcement`
- `message`
- `thread`
- `post`
- `session`
- `submission`
- `user`

## Priorite d'implementation conseillee

1. `GET /health`
2. `POST /auth/login`
3. `POST /auth/register`
4. `POST /payments/init`
5. `GET /payments/status`
6. `POST /payments/confirm`
7. `POST /payments/webhook/:provider`
8. `GET /lms/state`
9. `PUT /lms/state`
10. `POST /lms/events`

## Recommandations backend

- hasher tous les mots de passe
- ne jamais renvoyer le mot de passe en clair
- journaliser chaque evenement metier
- valider les roles et permissions cote serveur
- securiser les paiements avec callback et signature
- stocker les pieces jointes dans un stockage dedie
### Session courante

- Methode : `GET`
- Route par defaut : `/auth/me`

Reponse attendue :

```json
{
  "user": {
    "id": "usr_123",
    "name": "Nom Prenom",
    "email": "user@example.com",
    "role": "student"
  }
}
```

### Resume plateforme

- Methode : `GET`
- Route par defaut : `/lms/summary`

### Consultation des evenements

- Methode : `GET`
- Route par defaut : `/lms/events`
