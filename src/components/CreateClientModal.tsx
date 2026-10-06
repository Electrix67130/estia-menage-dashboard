"use client";

import { useState, FormEvent } from "react";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useCreateClient } from "@/hooks/useClients";
import { useI18n } from "@/contexts/I18nContext";
import { ApiError } from "@/lib/api";
import type { CreateClientInput, Client } from "@/types/api";

interface Props {
  onClose: () => void;
  /** Appelé après création réussie avec le client créé. */
  onCreated?: (client: Client) => void;
}

export default function CreateClientModal({ onClose, onCreated }: Props) {
  const { t } = useI18n();
  const create = useCreateClient();
  const [form, setForm] = useState<CreateClientInput>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.first_name && !form.last_name && !form.company_name) {
      toast.error(t("clients.nameRequired"));
      return;
    }
    try {
      const created = await create.mutateAsync(form);
      toast.success(t("clients.created"));
      onCreated?.(created);
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("common.error");
      toast.error(msg);
    }
  };

  return (
    <Modal open onClose={onClose} title={t("clients.new")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("clients.firstName")}>
            <Input
              value={form.first_name ?? ""}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </Field>
          <Field label={t("clients.lastName")}>
            <Input
              value={form.last_name ?? ""}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t("clients.companyIfPro")}>
          <Input
            value={form.company_name ?? ""}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("common.email")}>
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label={t("clients.phone")}>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t("clients.billingAddress")}>
          <Input
            value={form.billing_address ?? ""}
            onChange={(e) => setForm({ ...form, billing_address: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("menages.form.postalCode")}>
            <Input
              value={form.postal_code ?? ""}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            />
          </Field>
          <Field label={t("menages.form.city")}>
            <Input
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <Field label={t("clients.country")}>
            <Input
              value={form.country ?? "FR"}
              maxLength={2}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
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
          <Field label={t("clients.vatNumber")}>
            <Input
              value={form.vat_number ?? ""}
              onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t("clients.creating") : t("emergencies.create")}
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
