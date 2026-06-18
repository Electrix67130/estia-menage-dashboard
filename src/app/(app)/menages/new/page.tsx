"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BackLink from "@/components/BackLink";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import Textarea from "@/components/ui/Textarea";
import DurationPicker from "@/components/ui/DurationPicker";
import { useAuth } from "@/contexts/AuthContext";
import { useLogementsList } from "@/hooks/useLogementsList";
import { useLogement } from "@/hooks/useLogement";
import { useCreateMenage } from "@/hooks/useMenageDetail";
import { useOrgPrestataires } from "@/hooks/useLogementMembers";
import { ApiError } from "@/lib/api";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function NewMenageForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const logements = useLogementsList();
  const create = useCreateMenage();

  const initialDate = useMemo(() => {
    const d = params.get("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayIso();
  }, [params]);
  const initialLogementId = params.get("logement_id") ?? "";

  const [logementId, setLogementId] = useState<string>(initialLogementId);
  const [datePrevue, setDatePrevue] = useState<string>(initialDate);
  const [horairePrevu, setHorairePrevu] = useState<string>("");
  const [dureeEstimee, setDureeEstimee] = useState<string>("");
  const [prestataireUserId, setPrestataireUserId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [clientPriceHt, setClientPriceHt] = useState<string>("");
  const [clientVatRate, setClientVatRate] = useState<string>("20");
  const [providerPrice, setProviderPrice] = useState<string>("");
  const [laundryIncluded, setLaundryIncluded] = useState<boolean>(false);
  const [laundryClientPriceHt, setLaundryClientPriceHt] = useState<string>("");
  const [laundryProviderPrice, setLaundryProviderPrice] = useState<string>("");

  const prestataires = useOrgPrestataires();
  const selectedLogement = useLogement(logementId || undefined);

  // Quand on change de logement, pré-remplir avec ses defaults SANS écraser ce
  // que l'utilisateur a déjà saisi manuellement.
  const lastAppliedLogementId = useRef<string>("");
  useEffect(() => {
    const l = selectedLogement.data;
    if (!l) return;
    if (lastAppliedLogementId.current === l.id) return;
    lastAppliedLogementId.current = l.id;

    const toStr = (v: number | string | null | undefined) =>
      v === null || v === undefined || v === "" ? "" : String(v);
    setHorairePrevu((prev) => prev || (l.default_horaire_debut ?? ""));
    setDureeEstimee((prev) => prev || toStr(l.default_duration_min));
    setClientPriceHt((prev) => prev || toStr(l.default_client_price_ht));
    setClientVatRate((prev) => (prev && prev !== "20" ? prev : toStr(l.default_client_vat_rate) || "20"));
    setProviderPrice((prev) => prev || toStr(l.default_provider_price));
    if (l.default_laundry_included) {
      setLaundryIncluded(true);
      setLaundryClientPriceHt((prev) => prev || toStr(l.default_laundry_client_price_ht));
      setLaundryProviderPrice((prev) => prev || toStr(l.default_laundry_provider_price));
    }
  }, [selectedLogement.data]);

  if (!isAdmin) {
    return (
      <Card className="border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
        Seul un administrateur peut créer un ménage.
      </Card>
    );
  }

  const sortedLogements = (logements.data?.data ?? [])
    .filter((l) => !l.archived_at)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logementId) {
      toast.error("Sélectionne un logement");
      return;
    }
    if (!datePrevue) {
      toast.error("La date est requise");
      return;
    }
    const duree = dureeEstimee ? parseInt(dureeEstimee, 10) : undefined;
    if (dureeEstimee && (Number.isNaN(duree) || (duree ?? -1) < 0)) {
      toast.error("Durée invalide");
      return;
    }
    const parseMoney = (s: string, label: string): number | undefined | "invalid" => {
      if (!s.trim()) return undefined;
      const n = parseFloat(s.replace(",", "."));
      if (Number.isNaN(n) || n < 0) {
        toast.error(`${label} invalide`);
        return "invalid";
      }
      return n;
    };
    const cPrice = parseMoney(clientPriceHt, "Prix client HT");
    if (cPrice === "invalid") return;
    const cVat = parseMoney(clientVatRate, "TVA");
    if (cVat === "invalid") return;
    const pPrice = parseMoney(providerPrice, "Prix prestataire");
    if (pPrice === "invalid") return;
    const lCPrice = parseMoney(laundryClientPriceHt, "Prix linge client HT");
    if (lCPrice === "invalid") return;
    const lPPrice = parseMoney(laundryProviderPrice, "Prix linge prestataire");
    if (lPPrice === "invalid") return;
    try {
      const menage = await create.mutateAsync({
        logement_id: logementId,
        date_prevue: datePrevue,
        horaire_prevu: horairePrevu || undefined,
        duree_estimee_min: duree,
        prestataire_user_id: prestataireUserId || undefined,
        notes_intervention: notes.trim() || undefined,
        client_price_ht: cPrice,
        client_vat_rate: cVat,
        provider_price: pPrice,
        laundry_included: laundryIncluded,
        laundry_client_price_ht: laundryIncluded ? lCPrice : undefined,
        laundry_provider_price: laundryIncluded ? lPPrice : undefined,
      });
      toast.success("Ménage créé");
      router.push(`/menages/${menage.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erreur";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Informations
        </h2>

        {initialLogementId ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900/40 dark:bg-blue-900/20">
            <p className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-300">Logement</p>
            <p className="mt-0.5 font-semibold text-zinc-900 dark:text-white">
              {sortedLogements.find((l) => l.id === logementId)?.name ?? "Logement sélectionné"}
            </p>
          </div>
        ) : (
          <Select
            label="Logement"
            value={logementId}
            onChange={(e) => {
              setLogementId(e.target.value);
              setPrestataireUserId("");
            }}
            disabled={logements.isLoading}
            required
          >
            <option value="">— Sélectionner —</option>
            {sortedLogements.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.city ? ` · ${l.city}` : ""}
              </option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DatePicker
            label="Date prévue"
            value={datePrevue}
            onChange={setDatePrevue}
            required
          />
          <TimePicker
            label="Horaire (optionnel)"
            value={horairePrevu}
            onChange={setHorairePrevu}
          />
        </div>

        <DurationPicker label="Durée estimée" value={dureeEstimee} onChange={setDureeEstimee} />

        <Select
          label="Prestataire (optionnel)"
          value={prestataireUserId}
          onChange={(e) => setPrestataireUserId(e.target.value)}
          disabled={prestataires.isLoading}
          hint="Tout prestataire de l'organisation (remplacement possible même hors logement)."
        >
          <option value="">— Non assigné —</option>
          {(prestataires.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.first_name} {p.last_name}
            </option>
          ))}
        </Select>

        <Textarea
          label="Notes d'intervention (optionnel)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Consignes particulières, accès, codes…"
        />
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Tarification
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Le prestataire ne verra que son propre montant.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Prix client HT (€)"
            type="number"
            min={0}
            step="0.01"
            placeholder="ex. 80"
            value={clientPriceHt}
            onChange={(e) => setClientPriceHt(e.target.value)}
          />
          <Input
            label="TVA (%)"
            type="number"
            min={0}
            max={100}
            step="0.1"
            placeholder="20"
            value={clientVatRate}
            onChange={(e) => setClientVatRate(e.target.value)}
          />
          <Input
            label="Prix prestataire (€)"
            type="number"
            min={0}
            step="0.01"
            placeholder="ex. 50"
            value={providerPrice}
            onChange={(e) => setProviderPrice(e.target.value)}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Linge
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Activer si la gestion du linge est incluse pour ce ménage.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={laundryIncluded}
              onChange={(e) => setLaundryIncluded(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Inclus
          </label>
        </div>
        {laundryIncluded ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Prix linge — client HT (€)"
              type="number"
              min={0}
              step="0.01"
              placeholder="ex. 15"
              value={laundryClientPriceHt}
              onChange={(e) => setLaundryClientPriceHt(e.target.value)}
            />
            <Input
              label="Prix linge — prestataire (€)"
              type="number"
              min={0}
              step="0.01"
              placeholder="ex. 10"
              value={laundryProviderPrice}
              onChange={(e) => setLaundryProviderPrice(e.target.value)}
            />
          </div>
        ) : null}
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/calendar">
          <Button type="button" variant="ghost">
            Annuler
          </Button>
        </Link>
        <Button type="submit" loading={create.isPending} disabled={create.isPending}>
          Créer le ménage
        </Button>
      </div>
    </form>
  );
}

export default function NewMenagePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <BackLink fallback="/menages" />
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Nouveau ménage
      </h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
        <NewMenageForm />
      </Suspense>
    </div>
  );
}
