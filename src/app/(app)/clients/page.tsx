"use client";

import { useState, FormEvent, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Building2, User as UserIcon, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import {
  useClients,
  useCreateClient,
} from "@/hooks/useClients";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { formatDateFr } from "@/lib/date-fr";
import type { CreateClientInput, Client } from "@/types/api";

export default function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 250);
  const list = useClients({ search: debouncedSearch || undefined });

  const total = list.data?.meta.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Clients</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {total} client{total > 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            Nouveau client
          </Button>
        ) : null}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, entreprise, email, ville…"
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="p-0">
        {list.isLoading ? (
          <p className="p-6 text-sm text-zinc-500">Chargement…</p>
        ) : list.data && list.data.data.length > 0 ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.data.data.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {c.company_name ? <Building2 size={18} /> : <UserIcon size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900 dark:text-white">
                      {clientDisplayName(c)}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {[c.city, c.email, c.phone].filter(Boolean).join(" · ") ||
                        "Aucun contact"}
                    </p>
                  </div>
                  <span className="hidden text-xs text-zinc-400 sm:block">
                    Créé le {formatDateFr(c.created_at, "short")}
                  </span>
                  <ChevronRight size={16} className="text-zinc-400" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-zinc-500">
            Aucun client {debouncedSearch ? "ne correspond à ta recherche." : "pour l'instant."}
          </p>
        )}
      </Card>

      {showCreate ? (
        <CreateClientModal onClose={() => setShowCreate(false)} />
      ) : null}
    </div>
  );
}

export function clientDisplayName(c: Client): string {
  if (c.company_name) {
    const person = [c.first_name, c.last_name].filter(Boolean).join(" ");
    return person ? `${c.company_name} — ${person}` : c.company_name;
  }
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sans nom";
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const create = useCreateClient();
  const [form, setForm] = useState<CreateClientInput>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.first_name && !form.last_name && !form.company_name) {
      toast.error("Au moins un nom (personne ou entreprise) est requis");
      return;
    }
    try {
      await create.mutateAsync(form);
      toast.success("Client créé");
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erreur";
      toast.error(msg);
    }
  };

  return (
    <Modal open onClose={onClose} title="Nouveau client">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom">
            <Input
              value={form.first_name ?? ""}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </Field>
          <Field label="Nom">
            <Input
              value={form.last_name ?? ""}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Entreprise (si pro)">
          <Input
            value={form.company_name ?? ""}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Adresse de facturation">
          <Input
            value={form.billing_address ?? ""}
            onChange={(e) => setForm({ ...form, billing_address: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Code postal">
            <Input
              value={form.postal_code ?? ""}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            />
          </Field>
          <Field label="Ville">
            <Input
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <Field label="Pays">
            <Input
              value={form.country ?? "FR"}
              maxLength={2}
              onChange={(e) =>
                setForm({ ...form, country: e.target.value.toUpperCase() })
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SIRET">
            <Input
              maxLength={14}
              value={form.siret ?? ""}
              onChange={(e) => setForm({ ...form, siret: e.target.value })}
            />
          </Field>
          <Field label="N° TVA">
            <Input
              value={form.vat_number ?? ""}
              onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Création…" : "Créer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
    </label>
  );
}

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useMemoState(value);
  // simple polling-free debounce via setTimeout
  useTimeout(() => setDebounced(value), delay, value);
  return debounced;
}

// Tiny helpers to avoid extra deps
import { useEffect, useState as useReactState } from "react";
function useMemoState<T>(initial: T) {
  return useReactState<T>(initial);
}
function useTimeout(cb: () => void, delay: number, deps: unknown) {
  useEffect(() => {
    const t = setTimeout(cb, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, delay]);
}
