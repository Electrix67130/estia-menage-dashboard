"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Search, MapPin, Plus, ListChecks, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useLogementsList } from "@/hooks/useLogementsList";

export default function LogementsListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const list = useLogementsList();
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  const items = list.data?.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((l) => (includeArchived ? true : !l.archived_at))
      .filter((l) => {
        if (!q) return true;
        return (
          l.name.toLowerCase().includes(q) ||
          (l.address ?? "").toLowerCase().includes(q) ||
          (l.city ?? "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [items, search, includeArchived]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 size={24} className="text-zinc-500" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Logements</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {list.isLoading
                ? "Chargement…"
                : `${items.length} logement${items.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => list.refetch()}
            disabled={list.isFetching}
            aria-label="Rafraîchir"
          >
            <RefreshCw size={14} className={list.isFetching ? "animate-spin" : undefined} />
          </Button>
          {isAdmin ? (
            <>
              <Link href="/templates">
                <Button variant="ghost">
                  <ListChecks size={16} />
                  Modèles de checklist
                </Button>
              </Link>
              <Link href="/logements/new">
                <Button>
                  <Plus size={16} />
                  Nouveau logement
                </Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {list.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          {list.error instanceof Error ? list.error.message : "Erreur de chargement"}
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <Input
            placeholder="Nom, adresse, ville…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          Inclure les archivés
        </label>
      </div>

      {list.isLoading ? (
        <Card>
          <p className="text-sm text-zinc-500">Chargement…</p>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="Aucun logement"
          description={
            search
              ? "Aucun résultat pour cette recherche."
              : "Crée un logement pour commencer."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((l) => {
            const address = [l.address, l.city].filter(Boolean).join(", ");
            const archived = !!l.archived_at;
            return (
              <Link key={l.id} href={`/logements/${l.id}`}>
                <Card className="transition-colors hover:border-blue-500/50">
                  <div className="flex items-start gap-3">
                    {l.cover_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.cover_photo_url}
                        alt={l.name}
                        className="h-14 w-14 flex-shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border"
                        style={{
                          backgroundColor: l.color ? `${l.color}20` : undefined,
                          borderColor: l.color ?? undefined,
                        }}
                      >
                        <Building2 size={20} color={l.color ?? "#A1A1AA"} />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-base font-semibold text-zinc-900 dark:text-white">
                          {l.color ? (
                            <span
                              className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: l.color }}
                            />
                          ) : null}
                          {l.name}
                        </p>
                        {address ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                            <MapPin size={12} />
                            {address}
                          </p>
                        ) : null}
                      </div>
                      {archived ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                          Archivé
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
