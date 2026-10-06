"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import BackLink from "@/components/BackLink";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useClientReport, type ReportMenage } from "@/hooks/useClients";
import { formatDateFr, formatCurrencyFr } from "@/lib/date-fr";
import type { TFn } from "@/i18n/translations";

type PresetKey = "this-month" | "last-month" | "this-quarter" | "this-semester" | "this-year" | "custom";

const PRESETS: { key: PresetKey; labelKey: string }[] = [
  { key: "this-month", labelKey: "clients.report.thisMonth" },
  { key: "last-month", labelKey: "clients.report.lastMonth" },
  { key: "this-quarter", labelKey: "clients.report.thisQuarter" },
  { key: "this-semester", labelKey: "clients.report.thisSemester" },
  { key: "this-year", labelKey: "clients.report.thisYear" },
  { key: "custom", labelKey: "clients.report.custom" },
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetRange(key: Exclude<PresetKey, "custom">): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "this-month":
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case "last-month":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { from: ymd(new Date(y, qStart, 1)), to: ymd(new Date(y, qStart + 3, 0)) };
    }
    case "this-semester": {
      const sStart = m < 6 ? 0 : 6;
      return { from: ymd(new Date(y, sStart, 1)), to: ymd(new Date(y, sStart + 6, 0)) };
    }
    case "this-year":
      return { from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y, 11, 31)) };
  }
}

function num(v: string | null | undefined): number {
  if (v == null) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

interface RowComputed {
  m: ReportMenage;
  clientHt: number;
  laundryHt: number;
  totalHt: number;
  vatRate: number;
  vat: number;
  ttc: number;
  providerCost: number;
  margin: number;
}

function computeRow(m: ReportMenage): RowComputed {
  const clientHt = num(m.validated_price) || num(m.client_price_ht);
  const laundryHt = m.laundry_included ? num(m.laundry_client_price_ht) : 0;
  const totalHt = clientHt + laundryHt;
  const vatRate = num(m.client_vat_rate) || 20;
  const vat = totalHt * (vatRate / 100);
  const ttc = totalHt + vat;
  const provider = num(m.provider_price) + (m.laundry_included ? num(m.laundry_provider_price) : 0);
  return { m, clientHt, laundryHt, totalHt, vatRate, vat, ttc, providerCost: provider, margin: totalHt - provider };
}

interface Totals {
  count: number;
  clientHt: number;
  laundryHt: number;
  totalHt: number;
  vat: number;
  ttc: number;
  providerCost: number;
  margin: number;
}

function sumRows(rows: RowComputed[]): Totals {
  return rows.reduce<Totals>(
    (acc, r) => ({
      count: acc.count + 1,
      clientHt: acc.clientHt + r.clientHt,
      laundryHt: acc.laundryHt + r.laundryHt,
      totalHt: acc.totalHt + r.totalHt,
      vat: acc.vat + r.vat,
      ttc: acc.ttc + r.ttc,
      providerCost: acc.providerCost + r.providerCost,
      margin: acc.margin + r.margin,
    }),
    { count: 0, clientHt: 0, laundryHt: 0, totalHt: 0, vat: 0, ttc: 0, providerCost: 0, margin: 0 },
  );
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

/** « octobre 2026 » dans la langue de l'app (les formateurs suivent `I18nProvider`). */
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return formatDateFr(new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1), "month");
}

function prestataireLabel(m: ReportMenage): string {
  if (m.prestataires.length === 0) {
    return [m.referent_first_name, m.referent_last_name].filter(Boolean).join(" ") || "—";
  }
  return m.prestataires
    .map((p) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "—")
    .join(", ");
}

function clientName(
  c: { first_name: string | null; last_name: string | null; company_name: string | null },
  t: TFn,
): string {
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || t("clients.client");
}

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function ClientReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { t, tp } = useI18n();
  const [preset, setPreset] = useState<PresetKey>("this-month");
  const initial = presetRange("this-month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  useEffect(() => {
    if (preset !== "custom") {
      const r = presetRange(preset);
      setFrom(r.from);
      setTo(r.to);
    }
  }, [preset]);

  const report = useClientReport(id, from, to);

  const rows = useMemo(() => (report.data?.menages ?? []).map(computeRow), [report.data]);
  const totals = useMemo(() => sumRows(rows), [rows]);
  const byMonth = useMemo(() => {
    const map = new Map<string, RowComputed[]>();
    for (const r of rows) {
      const k = monthKey(r.m.date_prevue);
      const list = map.get(k) ?? [];
      list.push(r);
      map.set(k, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const currency = rows[0]?.m.currency ?? "EUR";
  const money = (value: number) => formatCurrencyFr(value, currency);
  const c = report.data?.client;
  const titleName = c ? clientName(c, t) : t("clients.client");

  if (user && user.role !== "admin") {
    return (
      <div className="p-8">
        <Card>
          <p className="text-zinc-600 dark:text-zinc-300">{t("common.adminOnly")}</p>
        </Card>
      </div>
    );
  }

  const handleCsv = () => {
    const headers = [
      t("clients.report.colDate"),
      t("clients.report.colLogement"),
      t("clients.report.csv.address"),
      t("menage.fields.prestataire"),
      t("clients.report.csv.laundryIncluded"),
      t("clients.report.csv.priceHtMenage"),
      t("clients.report.csv.priceHtLaundry"),
      t("invoices.totalHt"),
      t("clients.report.csv.vatRate"),
      t("invoices.vat"),
      t("clients.report.kpiTtc"),
      t("clients.report.csv.providerCost"),
      t("clients.report.kpiMargin"),
      t("clients.report.csv.status"),
      t("clients.report.csv.source"),
    ];
    const lines = [headers.join(";")];
    for (const r of rows) {
      lines.push(
        [
          r.m.date_prevue.slice(0, 10),
          r.m.logement_name ?? "",
          [r.m.logement_address, r.m.logement_city].filter(Boolean).join(" "),
          prestataireLabel(r.m),
          r.m.laundry_included ? t("clients.report.csv.yes") : t("clients.report.csv.no"),
          r.clientHt.toFixed(2),
          r.laundryHt.toFixed(2),
          r.totalHt.toFixed(2),
          r.vatRate.toFixed(2),
          r.vat.toFixed(2),
          r.ttc.toFixed(2),
          r.providerCost.toFixed(2),
          r.margin.toFixed(2),
          r.m.status,
          r.m.external_source ?? t("prestations.creatorManual"),
        ]
          .map(csvEscape)
          .join(";"),
      );
    }
    lines.push(
      [
        t("clients.report.csv.total"),
        "",
        "",
        "",
        "",
        totals.clientHt.toFixed(2),
        totals.laundryHt.toFixed(2),
        totals.totalHt.toFixed(2),
        "",
        totals.vat.toFixed(2),
        totals.ttc.toFixed(2),
        totals.providerCost.toFixed(2),
        totals.margin.toFixed(2),
        "",
        "",
      ]
        .map(csvEscape)
        .join(";"),
    );
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${titleName.replace(/\s+/g, "-").toLowerCase()}-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const title = t("clients.report.title", { name: titleName });

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <BackLink
            fallback={`/clients/${id}`}
            label={t("clients.report.backToClient")}
            size={14}
            className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          />
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleCsv} disabled={rows.length === 0}>
            <Download size={14} /> CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()} disabled={rows.length === 0}>
            <Printer size={14} /> {t("clients.report.print")}
          </Button>
        </div>
      </div>

      <Card className="no-print">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={
                  preset === p.key
                    ? "rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">{t("clients.report.from")}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setPreset("custom");
                  setFrom(e.target.value);
                }}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">{t("clients.report.to")}</span>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setPreset("custom");
                  setTo(e.target.value);
                }}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
          </div>
        </div>
      </Card>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-zinc-700">
          {t("clients.report.period", { from: formatDateFr(from), to: formatDateFr(to) })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Kpi label={t("nav.menages")} value={String(totals.count)} />
        <Kpi label={t("clients.report.kpiRevenueHt")} value={money(totals.totalHt)} />
        <Kpi label={t("invoices.vat")} value={money(totals.vat)} />
        <Kpi label={t("clients.report.kpiTtc")} value={money(totals.ttc)} accent="blue" />
        <Kpi label={t("clients.report.kpiProviderCost")} value={money(totals.providerCost)} />
        <Kpi
          label={t("clients.report.kpiMargin")}
          value={money(totals.margin)}
          accent={totals.margin >= 0 ? "green" : "red"}
        />
      </div>

      <Card>
        {report.isLoading ? (
          <p className="p-4 text-sm text-zinc-500">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">{t("clients.report.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2">{t("clients.report.colDate")}</th>
                  <th className="px-3 py-2">{t("clients.report.colLogement")}</th>
                  <th className="px-3 py-2">{t("menage.fields.prestataire")}</th>
                  <th className="px-3 py-2 text-center">{t("menage.edit.sectionLaundry")}</th>
                  <th className="px-3 py-2 text-right">{t("clients.report.colHt")}</th>
                  <th className="px-3 py-2 text-right">{t("invoices.vat")}</th>
                  <th className="px-3 py-2 text-right">{t("clients.report.kpiTtc")}</th>
                  <th className="px-3 py-2 text-right">{t("clients.report.colPresta")}</th>
                  <th className="px-3 py-2 text-right">{t("clients.report.kpiMargin")}</th>
                </tr>
              </thead>
              {byMonth.map(([mk, items]) => {
                const sub = sumRows(items);
                return (
                  <tbody key={mk} className="border-b border-zinc-100 dark:border-zinc-900">
                    <tr className="bg-zinc-50/70 dark:bg-zinc-900/40">
                      <td colSpan={9} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                        {tp("clients.report.monthCount", items.length, { month: monthLabel(mk) })}
                      </td>
                    </tr>
                    {items.map((r) => (
                      <tr key={r.m.id} className="border-t border-zinc-100 dark:border-zinc-900">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateFr(r.m.date_prevue.slice(0, 10))}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: r.m.logement_color ?? "#94a3b8" }}
                            />
                            <span className="truncate">{r.m.logement_name ?? "—"}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500">{r.m.logement_city ?? ""}</p>
                        </td>
                        <td className="px-3 py-2 truncate">{prestataireLabel(r.m)}</td>
                        <td className="px-3 py-2 text-center text-xs">
                          {r.m.laundry_included ? "✓" : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.totalHt)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.vat)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(r.ttc)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{money(r.providerCost)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${r.margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {money(r.margin)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-zinc-50 font-semibold text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
                      <td colSpan={4} className="px-3 py-2 text-right text-xs uppercase tracking-wide">
                        {t("clients.report.subtotal")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(sub.totalHt)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(sub.vat)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(sub.ttc)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(sub.providerCost)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${sub.margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {money(sub.margin)}
                      </td>
                    </tr>
                  </tbody>
                );
              })}
              <tfoot>
                <tr className="border-t-2 border-zinc-300 bg-blue-50/50 font-bold text-zinc-900 dark:border-zinc-700 dark:bg-blue-950/30 dark:text-white">
                  <td colSpan={4} className="px-3 py-3 text-right uppercase tracking-wide">
                    {t("clients.report.totalPeriod")}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(totals.totalHt)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(totals.vat)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-blue-700 dark:text-blue-300">{money(totals.ttc)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(totals.providerCost)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${totals.margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {money(totals.margin)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          aside, nav, header[role="banner"] { display: none !important; }
          body { background: white !important; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "blue" | "green" | "red" }) {
  const ring =
    accent === "blue"
      ? "ring-blue-200 dark:ring-blue-700/40"
      : accent === "green"
        ? "ring-emerald-200 dark:ring-emerald-700/40"
        : accent === "red"
          ? "ring-red-200 dark:ring-red-700/40"
          : "ring-zinc-200 dark:ring-zinc-800";
  const text =
    accent === "blue"
      ? "text-blue-700 dark:text-blue-300"
      : accent === "green"
        ? "text-emerald-700 dark:text-emerald-300"
        : accent === "red"
          ? "text-red-700 dark:text-red-300"
          : "text-zinc-900 dark:text-white";
  return (
    <div className={`rounded-lg bg-white p-3 ring-1 ${ring} dark:bg-zinc-900`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${text}`}>{value}</p>
    </div>
  );
}
