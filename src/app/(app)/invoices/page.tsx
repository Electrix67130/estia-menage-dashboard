"use client";

import { useState, useMemo, useEffect, FormEvent } from "react";
import Link from "next/link";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Receipt, Plus, Download, FileDown, RefreshCw, Trash2, Send, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { useI18n } from "@/contexts/I18nContext";
import { ApiError } from "@/lib/api";
import { formatDateFr, formatCurrencyFr } from "@/lib/date-fr";
import { useClients } from "@/hooks/useClients";
import { clientDisplayName } from "@/app/(app)/clients/page";
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useProviderRecap,
  downloadInvoiceFile,
  type Invoice,
  type InvoiceType,
  type InvoiceStatus,
} from "@/hooks/useInvoices";
import type { Client } from "@/types/api";

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  sent: "info",
  paid: "success",
  cancelled: "danger",
  accepted: "success",
  refused: "danger",
};

/** Clé i18n du libellé de chaque statut (`invoices.status.*`). */
const STATUS_KEY: Record<InvoiceStatus, string> = {
  draft: "invoices.status.draft",
  sent: "invoices.status.sent",
  paid: "invoices.status.paid",
  cancelled: "invoices.status.cancelled",
  accepted: "invoices.status.accepted",
  refused: "invoices.status.refused",
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { t, tp } = useI18n();
  const isAdmin = user?.role === "admin";
  const [type, setType] = usePersistedState<InvoiceType>("invoices.type", "invoice");
  const [showCreate, setShowCreate] = useState(false);
  // Pré-remplissage via deep-link depuis la page Gains (bouton « Facturer »).
  const [createPreset, setCreatePreset] = useState<{
    clientId?: string;
    start?: string;
    end?: string;
  } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("create") !== "1") return;
    setType("invoice");
    setCreatePreset({
      clientId: p.get("client_id") ?? undefined,
      start: p.get("from") ?? undefined,
      end: p.get("to") ?? undefined,
    });
    setShowCreate(true);
    // Nettoie l'URL pour qu'un refresh ne rouvre pas la modale.
    window.history.replaceState(null, "", "/invoices");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useInvoices({ type });
  const clientsList = useClients({ limit: 500 });
  const clientsById = useMemo(() => {
    const m = new Map<string, Client>();
    (clientsList.data?.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [clientsList.data]);

  const update = useUpdateInvoice();
  const del = useDeleteInvoice();

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("common.adminOnly")}</p>
        </Card>
      </div>
    );
  }

  const invoices = list.data?.data ?? [];
  const isQuote = type === "quote";

  const clientName = (id: string) => {
    const c = clientsById.get(id);
    return c ? clientDisplayName(c, t) : t("clients.client");
  };

  const handleDownloadPdf = async (inv: Invoice) => {
    const name = inv.number ?? "brouillon";
    try {
      await downloadInvoiceFile(`/invoices/${inv.id}/pdf`, `${isQuote ? "devis" : "facture"}-${name}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoices.downloadFailed"));
    }
  };

  const handleStatus = (inv: Invoice, status: InvoiceStatus) => {
    update.mutate(
      { id: inv.id, input: { status } },
      {
        onSuccess: () => toast.success(t("invoices.statusUpdated")),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
      },
    );
  };

  const handleDelete = async (inv: Invoice) => {
    const ok = await confirm({
      title: t("invoices.deleteDraftTitle"),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    del.mutate(inv.id, {
      onSuccess: () => toast.success(t("invoices.draftDeleted")),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : t("invoices.deleteFailed")),
    });
  };

  const handleExportCsv = async () => {
    const { start, end } = currentMonthRange();
    try {
      await downloadInvoiceFile(
        `/invoices/export.csv?from=${start}&to=${end}`,
        `factures-${start}_${end}.csv`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoices.exportFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Receipt size={24} className="text-zinc-500" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("invoices.title")}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {tp(isQuote ? "invoices.countQuote" : "invoices.countInvoice", invoices.length)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void list.refetch()}
            disabled={list.isFetching}
            aria-label={t("invoices.refresh")}
          >
            <RefreshCw size={14} className={list.isFetching ? "animate-spin" : undefined} />
          </Button>
          <Button variant="secondary" onClick={handleExportCsv}>
            <FileDown size={16} />
            {t("invoices.exportCsv")}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            {isQuote ? t("invoices.newQuote") : t("invoices.newInvoice")}
          </Button>
        </div>
      </div>

      <div className="inline-flex w-fit rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
        {([
          { key: "invoice" as InvoiceType, label: t("nav.invoices") },
          { key: "quote" as InvoiceType, label: t("invoices.quotes") },
        ]).map((tt) => {
          const active = type === tt.key;
          return (
            <button
              key={tt.key}
              onClick={() => setType(tt.key)}
              className={
                active
                  ? "rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }
            >
              {tt.label}
            </button>
          );
        })}
      </div>

      <Card className="p-0">
        {list.isLoading ? (
          <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>
        ) : invoices.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Receipt size={28} />}
              title={isQuote ? t("invoices.emptyQuotes") : t("invoices.emptyInvoices")}
              description={isQuote ? t("invoices.emptyQuotesDesc") : t("invoices.emptyInvoicesDesc")}
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="truncate font-medium text-zinc-900 hover:underline dark:text-white"
                  >
                    {inv.number ?? t("invoices.status.draft")}
                  </Link>
                  <p className="truncate text-xs text-zinc-500">
                    {clientName(inv.client_id)} · {formatDateFr(inv.issue_date)}
                  </p>
                </div>
                <span className="tabular-nums text-sm font-semibold text-zinc-900 dark:text-white">
                  {formatCurrencyFr(inv.total_ttc, inv.currency)}
                </span>
                <Badge variant={STATUS_VARIANT[inv.status]}>{t(STATUS_KEY[inv.status])}</Badge>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownloadPdf(inv)}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    aria-label={t("invoices.downloadPdf")}
                    title={t("invoices.downloadPdf")}
                  >
                    <Download size={16} />
                  </button>
                  {inv.status === "draft" ? (
                    <button
                      onClick={() => handleStatus(inv, "sent")}
                      disabled={update.isPending}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:hover:bg-blue-900/20"
                      aria-label={t("invoices.markSent")}
                      title={t("invoices.markSent")}
                    >
                      <Send size={16} />
                    </button>
                  ) : null}
                  {!isQuote && (inv.status === "sent" || inv.status === "draft") ? (
                    <button
                      onClick={() => handleStatus(inv, "paid")}
                      disabled={update.isPending}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-teal-50 hover:text-teal-600 disabled:opacity-50 dark:hover:bg-teal-900/20"
                      aria-label={t("invoices.markPaid")}
                      title={t("invoices.markPaid")}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  ) : null}
                  {inv.status === "draft" ? (
                    <button
                      onClick={() => handleDelete(inv)}
                      disabled={del.isPending}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/20"
                      aria-label={t("common.delete")}
                      title={t("common.delete")}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ProviderRecapSection />

      {showCreate ? (
        <CreateInvoiceModal
          type={type}
          clients={clientsList.data?.data ?? []}
          initialClientId={createPreset?.clientId}
          initialStart={createPreset?.start}
          initialEnd={createPreset?.end}
          onClose={() => {
            setShowCreate(false);
            setCreatePreset(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ProviderRecapSection() {
  const { t, tp } = useI18n();
  const recap = useProviderRecap();
  const rows = recap.data?.data ?? [];

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <Users size={16} className="text-zinc-400" />
        {t("invoices.providerRecap")}
      </h2>
      <Card className="p-0">
        {recap.isLoading ? (
          <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">{t("invoices.nothingToPay")}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r) => (
              <li key={r.user_id} className="flex items-center justify-between px-6 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-white">
                    {r.first_name} {r.last_name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t("prestations.total", {
                      count: r.n_menages,
                      noun: tp("prestations.noun.menage", r.n_menages),
                    })}
                  </p>
                </div>
                {/* TODO: bouton « Marquer payé » désactivé en v1 :
                    POST /invoices/provider-payments attend des menage_ids
                    que /invoices/provider-recap ne renvoie pas. Lecture seule. */}
                <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
                  {formatCurrencyFr(r.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CreateInvoiceModal({
  type,
  clients,
  onClose,
  initialClientId,
  initialStart,
  initialEnd,
}: {
  type: InvoiceType;
  clients: Client[];
  onClose: () => void;
  initialClientId?: string;
  initialStart?: string;
  initialEnd?: string;
}) {
  const { t } = useI18n();
  const create = useCreateInvoice();
  const month = currentMonthRange();
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [periodStart, setPeriodStart] = useState(initialStart ?? month.start);
  const [periodEnd, setPeriodEnd] = useState(initialEnd ?? month.end);
  const [notes, setNotes] = useState("");
  const isQuote = type === "quote";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error(t("invoices.selectClient"));
      return;
    }
    try {
      await create.mutateAsync({
        client_id: clientId,
        type,
        period_start: periodStart,
        period_end: periodEnd,
        notes: notes.trim() || undefined,
      });
      toast.success(isQuote ? t("invoices.quoteCreated") : t("invoices.created"));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  return (
    <Modal open onClose={onClose} title={isQuote ? t("invoices.newQuote") : t("invoices.newInvoice")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label={t("clients.client")}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
        >
          <option value="">{t("invoices.selectClientPlaceholder")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {clientDisplayName(c, t)}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("invoices.periodStart")}
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
          <Input
            label={t("invoices.periodEnd")}
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
          />
        </div>
        <Textarea
          label={t("invoices.notesOptional")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={create.isPending}>
            {isQuote ? t("invoices.createQuote") : t("invoices.createInvoice")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
