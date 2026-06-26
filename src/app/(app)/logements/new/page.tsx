"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import BackLink from "@/components/BackLink";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import DurationPicker from "@/components/ui/DurationPicker";
import ColorPicker from "@/components/ui/ColorPicker";
import CityAddressAutocomplete from "@/components/ui/CityAddressAutocomplete";
import CreateClientModal from "@/components/CreateClientModal";
import ClientPickerModal from "@/components/ClientPickerModal";
import { ChevronDown, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useCreateLogement, type CreateLogementInput } from "@/hooks/useLogement";
import { useClients } from "@/hooks/useClients";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { ApiError, apiFetch } from "@/lib/api";

function clientDisplayName(c: {
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client sans nom";
}

export default function NewLogementPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const create = useCreateLogement();
  const clients = useClients({ limit: 200 });

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [nBedrooms, setNBedrooms] = useState("0");
  const [nBathrooms, setNBathrooms] = useState("0");
  const [nWc, setNWc] = useState("0");
  const [nKitchens, setNKitchens] = useState("1");
  const [nLivingRooms, setNLivingRooms] = useState("1");
  const [nExteriorSpaces, setNExteriorSpaces] = useState("0");
  const [nLitSimple, setNLitSimple] = useState("0");
  const [nLitDouble, setNLitDouble] = useState("0");
  const [nCanapeLit, setNCanapeLit] = useState("0");
  const [nLitAppoint, setNLitAppoint] = useState("0");
  const [hasBasement, setHasBasement] = useState(false);
  const [hasLaundry, setHasLaundry] = useState(false);
  const [hasPool, setHasPool] = useState(false);
  const [hasJacuzzi, setHasJacuzzi] = useState(false);
  const [surfaceM2, setSurfaceM2] = useState("");
  const [keySafeCode, setKeySafeCode] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [defDuration, setDefDuration] = useState("");
  const [defHoraireDebut, setDefHoraireDebut] = useState("");
  const [defHoraireFin, setDefHoraireFin] = useState("");
  const [defClientPrice, setDefClientPrice] = useState("");
  const [defClientVat, setDefClientVat] = useState("20");
  const [defProviderPrice, setDefProviderPrice] = useState("");
  const [defLaundryIncluded, setDefLaundryIncluded] = useState(false);
  const [defLaundryClient, setDefLaundryClient] = useState("");
  const [defLaundryProvider, setDefLaundryProvider] = useState("");
  const [checklistTemplateId, setChecklistTemplateId] = useState("");
  const checklistTemplates = useChecklistTemplates();

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
          Seul un administrateur peut créer un logement.
        </Card>
      </div>
    );
  }

  const parseInt0 = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    const surface = surfaceM2.trim() ? parseInt(surfaceM2.trim(), 10) : undefined;
    if (surfaceM2.trim() && (surface === undefined || Number.isNaN(surface) || surface < 0)) {
      toast.error("Surface invalide");
      return;
    }
    const parseMoneyOrUndef = (s: string): number | undefined => {
      const t = s.trim();
      if (!t) return undefined;
      const n = parseFloat(t.replace(",", "."));
      return Number.isNaN(n) || n < 0 ? undefined : n;
    };
    const parseIntOrUndef = (s: string): number | undefined => {
      const t = s.trim();
      if (!t) return undefined;
      const n = parseInt(t, 10);
      return Number.isNaN(n) || n < 0 ? undefined : n;
    };
    const normalizeTime = (s: string): string | undefined => {
      const t = s.trim();
      if (!t) return undefined;
      return /^\d{2}:\d{2}(:\d{2})?$/.test(t) ? t : undefined;
    };
    const body: CreateLogementInput = {
      name: name.trim(),
      client_id: clientId || undefined,
      city: city.trim() || undefined,
      postal_code: postalCode.trim() || undefined,
      address: address.trim() || undefined,
      latitude,
      longitude,
      n_bedrooms: parseInt0(nBedrooms),
      n_bathrooms: parseInt0(nBathrooms),
      n_wc: parseInt0(nWc),
      n_kitchens: parseInt0(nKitchens),
      n_living_rooms: parseInt0(nLivingRooms),
      n_exterior_spaces: parseInt0(nExteriorSpaces),
      n_lit_simple: parseInt0(nLitSimple),
      n_lit_double: parseInt0(nLitDouble),
      n_canape_lit: parseInt0(nCanapeLit),
      n_lit_appoint: parseInt0(nLitAppoint),
      has_basement: hasBasement,
      has_laundry: hasLaundry,
      has_pool: hasPool,
      has_jacuzzi: hasJacuzzi,
      surface_m2: surface,
      key_safe_code: keySafeCode.trim() || undefined,
      notes: notes.trim() || undefined,
      color: color || undefined,
      default_duration_min: parseIntOrUndef(defDuration),
      default_horaire_debut: normalizeTime(defHoraireDebut),
      default_horaire_fin: normalizeTime(defHoraireFin),
      default_client_price_ht: parseMoneyOrUndef(defClientPrice),
      default_client_vat_rate: parseMoneyOrUndef(defClientVat),
      default_provider_price: parseMoneyOrUndef(defProviderPrice),
      default_laundry_included: defLaundryIncluded,
      default_laundry_client_price_ht: defLaundryIncluded
        ? parseMoneyOrUndef(defLaundryClient)
        : undefined,
      default_laundry_provider_price: defLaundryIncluded
        ? parseMoneyOrUndef(defLaundryProvider)
        : undefined,
    };
    try {
      const logement = await create.mutateAsync(body);
      if (checklistTemplateId) {
        try {
          await apiFetch(`/logements/${logement.id}/apply-checklist-template`, {
            method: "POST",
            body: { template_id: checklistTemplateId },
          });
        } catch {
          toast.warning("Logement créé, mais le modèle de checklist n'a pas pu être appliqué.");
        }
      }
      toast.success("Logement créé");
      router.push(`/logements/${logement.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <BackLink fallback="/logements" label="Retour aux logements" />
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Nouveau logement</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Informations
          </h2>
          <Input
            label="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Studio Paris 11e"
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Client (facturation)
            </label>
            <button
              type="button"
              onClick={() => setClientPickerOpen(true)}
              disabled={clients.isLoading}
              className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-sm hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
            >
              <User size={14} className="text-zinc-400" />
              <span className={clientId ? "flex-1 font-medium text-zinc-900 dark:text-white" : "flex-1 text-zinc-500"}>
                {clientId
                  ? clientDisplayName(
                      (clients.data?.data ?? []).find((c) => c.id === clientId) ?? {
                        company_name: "",
                        first_name: null,
                        last_name: null,
                      },
                    )
                  : "Aucun client — cliquer pour en choisir un"}
              </span>
              <ChevronDown size={14} className="text-zinc-400" />
            </button>
          </div>

          <CityAddressAutocomplete
            city={city}
            postalCode={postalCode}
            address={address}
            onCityChange={setCity}
            onAddressChange={setAddress}
            onCitySelect={(c, cp, lat, lng) => {
              setCity(c);
              setPostalCode(cp);
              setLatitude(lat);
              setLongitude(lng);
            }}
            onAddressSelect={(addr, lat, lng) => {
              setAddress(addr);
              setLatitude(lat);
              setLongitude(lng);
            }}
          />

          <Input
            label="Surface (m²)"
            value={surfaceM2}
            onChange={(e) => setSurfaceM2(e.target.value)}
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="ex. 65"
          />

          <ColorPicker label="Couleur (calendrier)" value={color} onChange={setColor} />
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t("logement.rooms.section")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Input label={t("logement.rooms.bedrooms")} type="number" min={0} value={nBedrooms} onChange={(e) => setNBedrooms(e.target.value)} />
            <Input label={t("logement.rooms.bathrooms")} type="number" min={0} value={nBathrooms} onChange={(e) => setNBathrooms(e.target.value)} />
            <Input label={t("logement.rooms.wc")} type="number" min={0} value={nWc} onChange={(e) => setNWc(e.target.value)} />
            <Input label={t("logement.rooms.kitchens")} type="number" min={0} value={nKitchens} onChange={(e) => setNKitchens(e.target.value)} />
            <Input label={t("logement.rooms.livingRooms")} type="number" min={0} value={nLivingRooms} onChange={(e) => setNLivingRooms(e.target.value)} />
            <Input label={t("logement.rooms.exteriorSpaces")} type="number" min={0} value={nExteriorSpaces} onChange={(e) => setNExteriorSpaces(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasBasement}
                onChange={(e) => setHasBasement(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t("logement.rooms.basement")}
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasLaundry}
                onChange={(e) => setHasLaundry(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t("logement.rooms.laundry")}
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasPool}
                onChange={(e) => setHasPool(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t("logement.rooms.pool")}
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasJacuzzi}
                onChange={(e) => setHasJacuzzi(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t("logement.rooms.jacuzzi")}
            </label>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {t("beds.section")}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">{t("beds.hintLogement")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input label={t("beds.simple")} type="number" min={0} value={nLitSimple} onChange={(e) => setNLitSimple(e.target.value)} />
            <Input label={t("beds.double")} type="number" min={0} value={nLitDouble} onChange={(e) => setNLitDouble(e.target.value)} />
            <Input label={t("beds.sofa")} type="number" min={0} value={nCanapeLit} onChange={(e) => setNCanapeLit(e.target.value)} />
            <Input label={t("beds.extra")} type="number" min={0} value={nLitAppoint} onChange={(e) => setNLitAppoint(e.target.value)} />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Valeurs par défaut du ménage
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Pré-remplies à la création d&apos;un ménage pour ce logement.
            </p>
          </div>

          <DurationPicker label="Durée par défaut" value={defDuration} onChange={setDefDuration} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Tranche horaire — début"
              type="time"
              value={defHoraireDebut}
              onChange={(e) => setDefHoraireDebut(e.target.value)}
            />
            <Input
              label="Tranche horaire — fin"
              type="time"
              value={defHoraireFin}
              onChange={(e) => setDefHoraireFin(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Prix client HT (€)"
              type="number"
              min={0}
              step="0.01"
              value={defClientPrice}
              onChange={(e) => setDefClientPrice(e.target.value)}
              placeholder="ex. 80"
            />
            <Input
              label="TVA (%)"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={defClientVat}
              onChange={(e) => setDefClientVat(e.target.value)}
              placeholder="20"
            />
            <Input
              label="Prix prestataire (€)"
              type="number"
              min={0}
              step="0.01"
              value={defProviderPrice}
              onChange={(e) => setDefProviderPrice(e.target.value)}
              placeholder="ex. 50"
            />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Linge inclus par défaut</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Activable individuellement à la création de chaque ménage.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={defLaundryIncluded}
                onChange={(e) => setDefLaundryIncluded(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              Inclus
            </label>
          </div>
          {defLaundryIncluded ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Prix linge — client HT (€)"
                type="number"
                min={0}
                step="0.01"
                value={defLaundryClient}
                onChange={(e) => setDefLaundryClient(e.target.value)}
                placeholder="ex. 15"
              />
              <Input
                label="Prix linge — prestataire (€)"
                type="number"
                min={0}
                step="0.01"
                value={defLaundryProvider}
                onChange={(e) => setDefLaundryProvider(e.target.value)}
                placeholder="ex. 10"
              />
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Checklist</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Applique un modèle de checklist (gérable dans Modèles). Tu pourras l&apos;ajuster ensuite.
            </p>
          </div>
          <Select
            label="Modèle de checklist (optionnel)"
            value={checklistTemplateId}
            onChange={(e) => setChecklistTemplateId(e.target.value)}
            disabled={checklistTemplates.isLoading}
          >
            <option value="">— Aucun —</option>
            {(checklistTemplates.data?.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.section_count} section{t.section_count > 1 ? "s" : ""})
              </option>
            ))}
          </Select>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Accès & notes</h2>
          <Input
            label="Code boîte à clés (optionnel)"
            type="password"
            autoComplete="off"
            value={keySafeCode}
            onChange={(e) => setKeySafeCode(e.target.value)}
            maxLength={50}
            placeholder="Ex. 1984"
          />
          <Textarea
            label="Notes (optionnel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Code interphone, instructions particulières, accès…"
          />
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Link href="/logements">
            <Button type="button" variant="ghost">
              Annuler
            </Button>
          </Link>
          <Button type="submit" loading={create.isPending} disabled={create.isPending}>
            Créer le logement
          </Button>
        </div>
      </form>

      <ClientPickerModal
        open={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        clients={clients.data?.data ?? []}
        selectedId={clientId}
        onSelect={(id) => {
          setClientId(id);
          setClientPickerOpen(false);
        }}
        onCreateNew={() => {
          setClientPickerOpen(false);
          setCreateClientOpen(true);
        }}
      />

      {createClientOpen ? (
        <CreateClientModal
          onClose={() => setCreateClientOpen(false)}
          onCreated={(c) => {
            setClientId(c.id);
            setCreateClientOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
