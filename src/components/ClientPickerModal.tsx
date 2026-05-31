"use client";

import { useMemo, useState } from "react";
import { Search, User, Plus, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import type { Client } from "@/types/api";

function clientDisplayName(c: {
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client sans nom";
}

interface Props {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  selectedId: string;
  onSelect: (clientId: string) => void;
  onCreateNew?: () => void;
}

/**
 * Modal recherchable pour choisir un client de facturation. Inspirée du flow
 * "gestion d'équipe" buildr : champ de recherche, liste scrollable, raccourci
 * "Créer un client" si fourni.
 */
export default function ClientPickerModal({
  open,
  onClose,
  clients,
  selectedId,
  onSelect,
  onCreateNew,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = clients.filter((c) => !c.archived_at);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [c.company_name, c.first_name, c.last_name, c.email, c.phone]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [clients, search]);

  return (
    <Modal open={open} onClose={onClose} title="Choisir un client" size="md">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <Search size={14} className="text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client…"
            autoFocus
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>

        {onCreateNew ? (
          <button
            type="button"
            onClick={onCreateNew}
            className="flex items-center justify-center gap-2 rounded-md border border-dashed border-blue-500 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <Plus size={14} />
            Créer un nouveau client
          </button>
        ) : null}

        <div className="max-h-80 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => onSelect("")}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
              selectedId === "" && "bg-blue-50 dark:bg-blue-900/20",
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <X size={14} className="text-zinc-400" />
            </div>
            <span
              className={cn(
                "flex-1",
                selectedId === ""
                  ? "font-semibold text-blue-700 dark:text-blue-300"
                  : "text-zinc-500",
              )}
            >
              Aucun client
            </span>
          </button>

          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">
              {search ? "Aucun résultat." : "Aucun client. Crée-en un."}
            </p>
          ) : (
            filtered.map((c) => {
              const isSelected = c.id === selectedId;
              const sub = [c.company_name ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null, c.email]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-t border-zinc-100 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50",
                    isSelected && "bg-blue-50 dark:bg-blue-900/20",
                  )}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                    <User size={14} className="text-blue-700 dark:text-blue-300" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate",
                        isSelected
                          ? "font-semibold text-blue-700 dark:text-blue-300"
                          : "font-medium text-zinc-900 dark:text-white",
                      )}
                    >
                      {clientDisplayName(c)}
                    </span>
                    {sub ? (
                      <span className="truncate text-xs text-zinc-500">{sub}</span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
