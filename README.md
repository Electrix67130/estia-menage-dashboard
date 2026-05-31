# Estia Ménage — Dashboard

Console d'administration web pour la gestion de prestations de ménage Estia. Front desktop de [l'API Estia](https://github.com/Electrix67130/estia-menage).

## Stack

- **Next.js 16** (App Router, React 19)
- **TypeScript** strict
- **TanStack Query** (cache & sync)
- **Tailwind CSS** + **lucide-react** (UI)
- **react-leaflet** + **leaflet** (carte des logements)
- **react-hook-form** + **zod** (formulaires)
- **i18n** custom (fr/en/de/es/it/pl/pt/tr)

## Démarrage rapide

Prérequis : Node 20+, l'API estia-menage qui tourne (cf. [estia-menage](https://github.com/Electrix67130/estia-menage)).

```bash
npm install
cp .env.local.example .env.local    # configure NEXT_PUBLIC_API_URL
npm run dev                          # http://localhost:3001
```

## Architecture

```
src/
├── app/(app)/       Routes protégées (admin authentifié)
│   ├── dashboard/      Accueil + KPIs
│   ├── menages/        Liste + détail + édition + création
│   ├── logements/      CRUD logements
│   ├── calendar/       Calendrier mensuel filtré
│   ├── clients/        Annuaire clients + rapport compta
│   ├── earnings/       Vue gains globale (par client + par presta)
│   ├── reschedule-requests/  Demandes de changement de date
│   ├── team/           Équipe (membres + clients)
│   ├── templates/      Modèles de checklist
│   ├── archives/       Ménages archivés
│   ├── settings/       Paramètres org + profil
│   └── admin/          Vue super-admin
├── app/(auth)/      Login, register, reset-password
├── components/      Composants UI (Card, Button, Modal, MenagesMap…)
├── contexts/        AuthContext, I18nContext, ToastContext
├── hooks/           useMenageDetail, useRescheduleRequests…
├── i18n/            8 locales
├── lib/             api client, date-fr, permissions, role-style
└── types/           Types API partagés
```

## Scripts npm

| Commande | Description |
|---|---|
| `npm run dev` | Dev (Turbopack) sur :3001 |
| `npm run build` | Build production |
| `npm start` | Lance le build prod |
| `npm run lint` | ESLint |

## Conventions

- **Parité dashboard ↔ mobile** : toute modification fonctionnelle doit être appliquée des deux côtés, sauf exceptions documentées (gestion abonnement = dashboard seul ; pointage photo géolocalisé = mobile seul).
- Le dashboard est **admin only** pour les opérations sensibles (assignation prestas, validation rapports, gestion clients).
- Le couple `Card` + Tailwind est la base UI. Lucide pour les icônes.

## Repos liés

- 🛠️ [estia-menage](https://github.com/Electrix67130/estia-menage) — API backend (Fastify + Knex).
- 📱 [estia-menage-ui](https://github.com/Electrix67130/estia-menage-ui) — app mobile (Expo).
- 🌐 [estia-menage-website](https://github.com/Electrix67130/estia-menage-website) — site vitrine.
