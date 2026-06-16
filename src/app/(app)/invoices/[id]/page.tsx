"use client";

import { use } from "react";
import { Download, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import BackLink from "@/components/BackLink";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { formatDateFr, formatCurrencyFr } from "@/lib/date-fr";
import {
  useInvoice,
  useUpdateInvoice,
  downloadInvoiceFile,
  type InvoiceStatus,
} from "@/hooks/useInvoices";

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  sent: "info",
  paid: "success",
  cancelled: "danger",
  accepted: "success",
  refused: "danger",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  cancelled: "Annulée",
  accepted: "Acceptée",
  refused: "Refusée",
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const query = useInvoice(id);
  const update = useUpdateInvoice();

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Accès réservé aux administrateurs.</p>
        </Card>
      </div>
    );
  }

  const invoice = query.data?.invoice;
  const lines = query.data?.lines ?? [];
  const isQuote = invoice?.type === "quote";

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    const name = invoice.number ?? "brouillon";
    try {
      await downloadInvoiceFile(
        `/invoices/${invoice.id}/pdf`,
        `${isQuote ? "devis" : "facture"}-${name}.pdf`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible");
    }
  };

  const handleStatus = (status: InvoiceStatus) => {
    if (!invoice) return;
    update.mutate(
      { id: invoice.id, input: { status } },
      {
        onSuccess: () => toast.success("Statut mis à jour"),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erreur"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <BackLink
        fallback="/invoices"
        label="Retour à la facturation"
        size={14}
        className="inline-flex w-fit items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      />

      {query.isLoading ? (
        <Card>
          <p className="text-sm text-zinc-500">Chargement…</p>
        </Card>
      ) : !invoice ? (
        <Card>
          <p className="text-sm text-zinc-500">Introuvable.</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {invoice.number ?? "Brouillon"}
                </h1>
                <Badge variant={STATUS_VARIANT[invoice.status]}>
                  {STATUS_LABEL[invoice.status]}
                </Badge>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {isQuote ? "Devis" : "Facture"} · émis le {formatDateFr(invoice.issue_date)}
                {invoice.due_date ? ` · échéance ${formatDateFr(invoice.due_date)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleDownloadPdf}>
                <Download size={16} />
                Télécharger PDF
              </Button>
              {invoice.status === "draft" ? (
                <Button onClick={() => handleStatus("sent")} loading={update.isPending}>
                  <Send size={16} />
                  Marquer envoyée
                </Button>
              ) : null}
              {!isQuote && (invoice.status === "sent" || invoice.status === "draft") ? (
                <Button onClick={() => handleStatus("paid")} loading={update.isPending}>
                  <CheckCircle2 size={16} />
                  Marquer payée
                </Button>
              ) : null}
            </div>
          </div>

          {invoice.period_start && invoice.period_end ? (
            <p className="text-sm text-zinc-500">
              Période : {formatDateFr(invoice.period_start)} – {formatDateFr(invoice.period_end)}
            </p>
          ) : null}

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    <th className="px-4 py-3 font-semibold">Désignation</th>
                    <th className="px-4 py-3 text-right font-semibold">Qté</th>
                    <th className="px-4 py-3 text-right font-semibold">PU HT</th>
                    <th className="px-4 py-3 text-right font-semibold">TVA</th>
                    <th className="px-4 py-3 text-right font-semibold">Total TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                        Aucune ligne.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3 text-zinc-900 dark:text-white">{line.label}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{line.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrencyFr(line.unit_price_ht, invoice.currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {Number(line.vat_rate).toFixed(1)} %
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-white">
                          {formatCurrencyFr(line.line_ttc, invoice.currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-end gap-1 border-t border-zinc-200 px-4 py-4 text-sm dark:border-zinc-800">
              <div className="flex w-56 justify-between">
                <span className="text-zinc-500">Total HT</span>
                <span className="tabular-nums">{formatCurrencyFr(invoice.total_ht, invoice.currency)}</span>
              </div>
              <div className="flex w-56 justify-between">
                <span className="text-zinc-500">TVA</span>
                <span className="tabular-nums">{formatCurrencyFr(invoice.total_tva, invoice.currency)}</span>
              </div>
              <div className="flex w-56 justify-between text-base font-bold text-zinc-900 dark:text-white">
                <span>Total TTC</span>
                <span className="tabular-nums">{formatCurrencyFr(invoice.total_ttc, invoice.currency)}</span>
              </div>
            </div>
          </Card>

          {invoice.notes ? (
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
                {invoice.notes}
              </p>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
