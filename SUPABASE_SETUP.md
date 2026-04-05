# Supabase Setup

Ce projet est maintenant prepare pour une bascule progressive vers Supabase.

## Fichiers fournis

- `supabase/schema.sql`
- `supabase/storage.sql`

## Etapes de mise en place

1. Ouvrez votre projet Supabase.
2. Allez dans `SQL Editor`.
3. Exécutez d'abord `supabase/schema.sql`.
4. Exécutez ensuite `supabase/storage.sql`.
5. Si vous aviez déjà installé le schéma avant les dernières mises à jour, réexécutez `supabase/schema.sql` pour ajouter les nouvelles colonnes comme `courses.release`.
5. Dans `Project Settings > API`, copiez :
   - `Project URL`
   - `anon public key`
6. Dans le LMS, ouvrez `Paramètres du site`.
7. Sélectionnez `Mode de persistance : Supabase`.
8. Renseignez :
   - `Project Ref`
   - `URL Supabase`
   - `Clé anonyme`
   - `Bucket de fichiers`

## Tables prévues

- `profiles`
- `courses`
- `course_modules`
- `lessons`
- `lesson_resources`
- `enrollments`
- `activities`
- `question_bank`
- `activity_questions`
- `submissions`
- `completion_records`
- `announcements`
- `messages`
- `forum_threads`
- `forum_posts`
- `attendance_sessions`
- `attendance_records`
- `notifications`
- `audit_logs`

## Remarque importante

Le site n'est pas encore entierement bascule sur Supabase dans cette etape.

Cette passe prepare :

- le schema de base
- les reglages dans l'interface
- la structure LMS compatible
- l'authentification Supabase cote client
- la creation automatique du profil LMS depuis Supabase Auth
- la synchronisation des profils, cours, modules, lecons, ressources, inscriptions, activites, soumissions et achevements
- les certificats emis par cours
- le depot des devoirs dans le bucket `adsl2ef-files`
- la synchronisation des notifications et du journal d'audit
- des ecritures directes sur Supabase pour les inscriptions, contenus pedagogiques, notifications, annonces et messages

La prochaine passe servira a brancher :

- les permissions reelles par role
- les messages, annonces, forums et assiduite sur les vraies tables

## Permissions

Le schema inclut maintenant une base de politiques RLS pour :

- `admin` : supervision globale
- `teacher` : accès a ses cours, cohortes et activites
- `student` : accès a ses cours, ses soumissions, sa progression et ses messages

Appliquez de nouveau `supabase/schema.sql` si vous aviez deja charge une ancienne version du schema.
