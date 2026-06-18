<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Parité mobile / dashboard

Toute modification fonctionnelle (nouvelle feature, changement de comportement, champ ajouté, action admin…) doit être appliquée **à la fois sur le dashboard (`estia-menage-dashboard`) ET sur le mobile (`estia-menage-ui`)**, sauf indication explicite du contraire.

Exceptions connues (ne PAS dupliquer) :
- **Gestion de l'abonnement** → dashboard uniquement.
- **Pointages photo géolocalisés (capture)** → mobile uniquement (le dashboard se contente d'afficher les preuves).

En cas de doute, demander avant de ne traiter qu'une seule des deux plateformes.

# Confirmations & alertes (UI)

**Jamais de `confirm()` / `alert()` natifs du navigateur** (ni `window.confirm`). Utiliser le dialogue de l'app : `useDialog()` (`@/contexts/DialogContext`).

```ts
const { confirm, alert } = useDialog();
const ok = await confirm({ title: "Supprimer ?", description: "…", confirmLabel: "Supprimer", tone: "danger" });
if (!ok) return;
```

Côté mobile (`estia-menage-ui`), même règle : `useDialog()` (jamais `Alert.alert` natif) — `confirm({ title, message?, destructive })` / `alert({ title, message })`.
