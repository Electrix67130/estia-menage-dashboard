"use client";

import { use, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import DurationPicker from "@/components/ui/DurationPicker";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  useMenageDetail,
  useUpdateMenage,
  useEligiblePrestataires,
  type UpdateMenageInput,
} from "@/hooks/useMenageDetail";
import { ApiError } from "@/lib/api";

export default function EditMenagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const detail = useMenageDetail(id);
  const update = useUpdateMenage(id);
  const eligible = useEligiblePrestataires(id);

  const [datePrevue, setDatePrevue] = useState("");
  const [horairePrevu, setHorairePrevu] = useState("");
  const [dureeEstimee, setDureeEstimee] = useState("");
  const [prestataireId, setPrestataireId] = useState<string>("");
  const [clientPriceHt, setClientPriceHt] = useState("");
  const [clientVatRate, setClientVatRate] = useState("");
  const [providerPrice, setProviderPrice] = useState("");
  const [laundryIncluded, setLaundryIncluded] = useState(false);
  const [laundryClientPriceHt, setLaundryClientPriceHt] = useState("");
  const [laundryProviderPrice, setLaundryProviderPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<UpdateMenageInput["status"]>("a_venir");
  const [nLitSimple, setNLitSimple] = useState("0");
  const [nLitDouble, setNLitDouble] = useState("0");
  const [nCanapeLit, setNCanapeLit] = useState("0");
  const [nLitAppoint, setNLitAppoint] = useState("0");

  useEffect(() => {
    const m = detail.data;
    if (!m) return;
    setDatePrevue(m.date_prevue.slice(0, 10));
    setHorairePrevu(m.horaire_prevu ? m.horaire_prevu.slice(0, 5) : "");
    setDureeEstimee(m.duree_estimee_min !== null ? String(m.duree_estimee_min) : "");
    setPrestataireId(m.prestataire_user_id ?? "");
    setClientPriceHt(m.client_price_ht !== null && m.client_price_ht !== undefined ? String(m.client_price_ht) : "");
    setClientVatRate(m.client_vat_rate !== null && m.client_vat_rate !== undefined ? String(m.client_vat_rate) : "");
    setProviderPrice(m.provider_price !== null && m.provider_price !== undefined ? String(m.provider_price) : "");
    setLaundryIncluded(m.laundry_included);
    setLaundryClientPriceHt(m.laundry_client_price_ht !== null && m.laundry_client_price_ht !== undefined ? String(m.laundry_client_price_ht) : "");
    setLaundryProviderPrice(m.laundry_provider_price !== null && m.laundry_provider_price !== undefined ? String(m.laundry_provider_price) : "");
    setNotes(m.notes_intervention ?? "");
    setStatus(m.status);
    setNLitSimple(String(m.n_lit_simple ?? 0));
    setNLitDouble(String(m.n_lit_double ?? 0));
    setNCanapeLit(String(m.n_canape_lit ?? 0));
    setNLitAppoint(String(m.n_lit_appoint ?? 0));
  }, [detail.data]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
          {t("menage.edit.adminOnly")}
        </Card>
      </div>
    );
  }

  const parseMoney = (s: string, label: string): number | null | "invalid" => {
    if (!s.trim()) return null;
    const n = parseFloat(s.replace(",", "."));
    if (Number.isNaN(n) || n < 0) {
      toast.error(t("menage.errors.fieldInvalid", { field: label }));
      return "invalid";
    }
    return n;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!datePrevue) {
      toast.error(t("menage.errors.dateRequired"));
      return;
    }
    const duree = dureeEstimee.trim() ? parseInt(dureeEstimee, 10) : null;
    if (dureeEstimee.trim() && (duree === null || Number.isNaN(duree) || duree < 0)) {
      toast.error(t("menage.errors.dureeInvalid"));
      return;
    }
    const cPrice = parseMoney(clientPriceHt, t("menage.fields.clientPriceHt"));
    if (cPrice === "invalid") return;
    const cVat = parseMoney(clientVatRate, t("menage.fields.clientVatRate"));
    if (cVat === "invalid") return;
    const pPrice = parseMoney(providerPrice, t("menage.fields.providerPrice"));
    if (pPrice === "invalid") return;
    const lCPrice = parseMoney(laundryClientPriceHt, t("menage.fields.laundryClientHt"));
    if (lCPrice === "invalid") return;
    const lPPrice = parseMoney(laundryProviderPrice, t("menage.fields.laundryProvider"));
    if (lPPrice === "invalid") return;

    const parseCount = (s: string): number => {
      const n = parseInt(s, 10);
      return Number.isNaN(n) || n < 0 ? 0 : n;
    };

    const body: UpdateMenageInput = {
      date_prevue: datePrevue,
      horaire_prevu: horairePrevu || null,
      duree_estimee_min: duree,
      prestataire_user_id: prestataireId || null,
      client_price_ht: cPrice,
      client_vat_rate: cVat,
      provider_price: pPrice,
      laundry_included: laundryIncluded,
      laundry_client_price_ht: laundryIncluded ? lCPrice : null,
      laundry_provider_price: laundryIncluded ? lPPrice : null,
      n_lit_simple: parseCount(nLitSimple),
      n_lit_double: parseCount(nLitDouble),
      n_canape_lit: parseCount(nCanapeLit),
      n_lit_appoint: parseCount(nLitAppoint),
      notes_intervention: notes.trim() || null,
      status,
    };

    try {
      await update.mutateAsync(body);
      toast.success(t("menage.success.updated"));
      router.push(`/menages/${id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  if (detail.isLoading) {
    return <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>;
  }
  if (detail.error || !detail.data) {
    return (
      <div className="p-6">
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          {detail.error instanceof Error ? detail.error.message : t("menage.edit.notFound")}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href={`/menages/${id}`}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        {t("menage.edit.backToMenage")}
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("menage.edit.title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            {t("menage.edit.sectionPlanning")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t("menage.fields.datePrevue")} type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} required />
            <Input label={t("menage.fields.horaire")} type="time" value={horairePrevu} onChange={(e) => setHorairePrevu(e.target.value)} />
          </div>
          <DurationPicker label={t("menage.fields.dureeEstimee")} value={dureeEstimee} onChange={setDureeEstimee} />
          <Select
            label={t("menage.fields.prestataire")}
            value={prestataireId}
            onChange={(e) => setPrestataireId(e.target.value)}
            disabled={eligible.isLoading}
          >
            <option value="">{t("menage.fields.unassigned")}</option>
            {(eligible.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </Select>
          <Select
            label={t("menage.edit.sectionStatus")}
            value={status}
            onChange={(e) => setStatus(e.target.value as UpdateMenageInput["status"])}
          >
            <option value="a_venir">{t("menages.statusUpcoming")}</option>
            <option value="en_cours">{t("menages.statusInProgress")}</option>
            <option value="termine">{t("menages.statusCompleted")}</option>
            <option value="valide">{t("menages.statusValidated")}</option>
            <option value="annule">{t("menages.statusCancelled")}</option>
          </Select>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t("menage.edit.sectionPricing")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label={t("menage.fields.clientPriceHt")} type="number" min={0} step="0.01" value={clientPriceHt} onChange={(e) => setClientPriceHt(e.target.value)} />
            <Input label={t("menage.fields.clientVatRate")} type="number" min={0} max={100} step="0.1" value={clientVatRate} onChange={(e) => setClientVatRate(e.target.value)} />
            <Input label={t("menage.fields.providerPrice")} type="number" min={0} step="0.01" value={providerPrice} onChange={(e) => setProviderPrice(e.target.value)} />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t("menage.edit.sectionLaundry")}</h2>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={laundryIncluded}
                onChange={(e) => setLaundryIncluded(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t("menage.fields.laundryIncludedShort")}
            </label>
          </div>
          {laundryIncluded ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label={t("menage.fields.laundryClientHt")} type="number" min={0} step="0.01" value={laundryClientPriceHt} onChange={(e) => setLaundryClientPriceHt(e.target.value)} />
              <Input label={t("menage.fields.laundryProvider")} type="number" min={0} step="0.01" value={laundryProviderPrice} onChange={(e) => setLaundryProviderPrice(e.target.value)} />
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {t("beds.section")}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">{t("beds.hintMenage")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input label={t("beds.simple")} type="number" min={0} value={nLitSimple} onChange={(e) => setNLitSimple(e.target.value)} />
            <Input label={t("beds.double")} type="number" min={0} value={nLitDouble} onChange={(e) => setNLitDouble(e.target.value)} />
            <Input label={t("beds.sofa")} type="number" min={0} value={nCanapeLit} onChange={(e) => setNCanapeLit(e.target.value)} />
            <Input label={t("beds.extra")} type="number" min={0} value={nLitAppoint} onChange={(e) => setNLitAppoint(e.target.value)} />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t("menage.edit.sectionNotes")}</h2>
          <Textarea
            label={t("menage.fields.notesIntervention")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={5000}
          />
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Link href={`/menages/${id}`}>
            <Button type="button" variant="ghost">
              {t("common.cancel")}
            </Button>
          </Link>
          <Button type="submit" loading={update.isPending} disabled={update.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
