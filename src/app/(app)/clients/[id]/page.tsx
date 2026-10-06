"use client";

import { use, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, FileBarChart, Trash2 } from "lucide-react";
import BackLink from "@/components/BackLink";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ContactLink from "@/components/ContactLink";
import {
  useArchiveClient,
  useClient,
  useClientLogements,
  useUpdateClient,
} from "@/hooks/useClients";
import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { useI18n } from "@/contexts/I18nContext";
import { ApiError } from "@/lib/api";
import { formatDateFr } from "@/lib/date-fr";
import { clientDisplayName } from "../page";
import type { Client, UpdateClientInput } from "@/types/api";

function clientToFormInput(c: Client): UpdateClientInput {
  return {
    first_name: c.first_name ?? undefined,
    last_name: c.last_name ?? undefined,
    company_name: c.company_name ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    billing_address: c.billing_address ?? undefined,
    postal_code: c.postal_code ?? undefined,
    city: c.city ?? undefined,
    country: c.country ?? "FR",
    siret: c.siret ?? undefined,
    vat_number: c.vat_number ?? undefined,
    notes: c.notes ?? undefined,
  };
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { t } = useI18n();
  const isAdmin = user?.role === "admin";
  const client = useClient(id);
  const logements = useClientLogements(id);
  const update = useUpdateClient();
  const archive = useArchiveClient();
  const [form, setForm] = useState<UpdateClientInput | null>(null);

  if (client.isLoading) return <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>;
  if (!client.data) return <p className="p-6 text-sm text-zinc-500">{t("clients.notFound")}</p>;

  const c = client.data;
  const editing = form !== null;
  const current = (form ?? c) as UpdateClientInput & typeof c;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    try {
      await update.mutateAsync({ id, input: form });
      toast.success(t("clients.updated"));
      setForm(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("common.error");
      toast.error(msg);
    }
  };

  const handleArchive = async () => {
    const ok = await confirm({
      title: t("clients.archiveTitle", { name: clientDisplayName(c, t) }),
      tone: "danger",
      confirmLabel: t("clients.archive"),
    });
    if (!ok) return;
    try {
      await archive.mutateAsync(id);
      toast.success(t("clients.archived"));
      router.push("/clients");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("common.error");
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <BackLink fallback="/clients" label={t("clients.backToClients")} />
        {isAdmin && !editing ? (
          <div className="flex gap-2">
            <Link href={`/clients/${id}/report`}>
              <Button variant="ghost">
                <FileBarChart size={14} /> {t("clients.report.link")}
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => setForm(clientToFormInput(c))}>
              {t("common.edit")}
            </Button>
            <Button variant="danger" onClick={handleArchive}>
              <Trash2 size={14} /> {t("clients.archive")}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          <Building2 size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {clientDisplayName(c, t)}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("clients.createdOn", { date: formatDateFr(c.created_at, "long") })}
          </p>
        </div>
      </div>

      {editing ? (
        <Card className="p-6">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("clients.firstName")}>
                <Input
                  value={current.first_name ?? ""}
                  onChange={(e) => setForm({ ...form!, first_name: e.target.value })}
                />
              </Field>
              <Field label={t("clients.lastName")}>
                <Input
                  value={current.last_name ?? ""}
                  onChange={(e) => setForm({ ...form!, last_name: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t("clients.company")}>
              <Input
                value={current.company_name ?? ""}
                onChange={(e) => setForm({ ...form!, company_name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("common.email")}>
                <Input
                  type="email"
                  value={current.email ?? ""}
                  onChange={(e) => setForm({ ...form!, email: e.target.value })}
                />
              </Field>
              <Field label={t("clients.phone")}>
                <Input
                  value={current.phone ?? ""}
                  onChange={(e) => setForm({ ...form!, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t("menages.form.address")}>
              <Input
                value={current.billing_address ?? ""}
                onChange={(e) => setForm({ ...form!, billing_address: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("menages.form.postalCode")}>
                <Input
                  value={current.postal_code ?? ""}
                  onChange={(e) => setForm({ ...form!, postal_code: e.target.value })}
                />
              </Field>
              <Field label={t("menages.form.city")}>
                <Input
                  value={current.city ?? ""}
                  onChange={(e) => setForm({ ...form!, city: e.target.value })}
                />
              </Field>
              <Field label={t("clients.country")}>
                <Input
                  value={current.country ?? "FR"}
                  maxLength={2}
                  onChange={(e) =>
                    setForm({ ...form!, country: e.target.value.toUpperCase() })
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SIRET">
                <Input
                  maxLength={14}
                  value={current.siret ?? ""}
                  onChange={(e) => setForm({ ...form!, siret: e.target.value })}
                />
              </Field>
              <Field label={t("clients.vatNumber")}>
                <Input
                  value={current.vat_number ?? ""}
                  onChange={(e) => setForm({ ...form!, vat_number: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {t("clients.contact")}
            </h2>
            <Row label={t("common.email")}>
              <ContactLink kind="email" value={c.email} />
            </Row>
            <Row label={t("clients.phone")}>
              <ContactLink kind="phone" value={c.phone} />
            </Row>
            <Row label={t("menages.form.address")}>
              {(() => {
                const full = [
                  c.billing_address,
                  [c.postal_code, c.city].filter(Boolean).join(" "),
                  c.country,
                ]
                  .filter(Boolean)
                  .join(", ");
                return <ContactLink kind="address" value={full || null} />;
              })()}
            </Row>
            <Row label={t("clients.country")}>
              <span className="text-sm text-zinc-900 dark:text-white">{c.country || "—"}</span>
            </Row>
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {t("clients.legal")}
            </h2>
            <Row label="SIRET" value={c.siret} />
            <Row label={t("clients.vatNumber")} value={c.vat_number} />
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          {t("clients.linkedLogements")}
        </h2>
        {logements.isLoading ? (
          <p className="text-sm text-zinc-500">{t("common.loading")}</p>
        ) : Array.isArray(logements.data) && logements.data.length > 0 ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {logements.data.map((l) => {
              const logement = l as { id: string; name: string; city?: string };
              return (
                <li key={logement.id} className="py-3">
                  <p className="font-medium text-zinc-900 dark:text-white">{logement.name}</p>
                  {logement.city ? (
                    <p className="text-xs text-zinc-500">{logement.city}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">{t("clients.noLinkedLogement")}</p>
        )}
      </Card>
    </div>
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

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null | undefined;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 last:border-b-0 dark:border-zinc-800">
      <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="text-right">
        {children ?? (
          <span className="text-sm text-zinc-900 dark:text-white">{value || "—"}</span>
        )}
      </div>
    </div>
  );
}
