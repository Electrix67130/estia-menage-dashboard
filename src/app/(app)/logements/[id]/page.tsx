"use client";

import { use, useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { Plus, Trash2, Pencil, GripVertical, MapPin, Camera, Clock, AlertTriangle, PackageCheck, RefreshCw, CalendarClock, RotateCcw } from "lucide-react";
import BackLink from "@/components/BackLink";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import DurationPicker from "@/components/ui/DurationPicker";
import ColorPicker from "@/components/ui/ColorPicker";
import ClientPickerModal from "@/components/ClientPickerModal";
import { useI18n } from "@/contexts/I18nContext";
import { ChevronDown, User } from "lucide-react";
import {
  useLogementPhotos,
  useCreatePhoto,
  useDeletePhoto,
} from "@/hooks/useLogementPhotos";
import { useMenages } from "@/hooks/useMenages";
import { uploadFile } from "@/lib/upload";
import { formatDateFr } from "@/lib/date-fr";
import {
  useLogementRooms,
  useCreateLogementRoom,
  useDeleteLogementRoom,
  type RoomKind,
  type LogementRoom,
} from "@/hooks/useLogementRooms";
import {
  useCheckTemplate,
  useCreateTemplateSection,
  useUpdateTemplateSection,
  useDeleteTemplateSection,
  useCreateTemplateItem,
  useUpdateTemplateItem,
  useDeleteTemplateItem,
  useReorderTemplateSections,
  type CheckTemplateSection,
} from "@/hooks/useCheckTemplate";
import {
  useLogement,
  useUpdateLogement,
  useDeleteLogement,
  useUnarchiveLogement,
  type Logement,
  type UpdateLogementInput,
} from "@/hooks/useLogement";
import { useRouter } from "next/navigation";
import {
  useLogementConsommables,
  useCreateConsommable,
  useUpdateConsommable,
  useDeleteConsommable,
  useSetConsommableStock,
  type ConsommableLine,
} from "@/hooks/useLogementConsommables";
import { useClients, useClient } from "@/hooks/useClients";
import Avatar from "@/components/ui/Avatar";
import StatusBadge from "@/components/StatusBadge";
import {
  useLogementMembers,
  useAddLogementMember,
  useRemoveLogementMember,
  useOrgPrestataires,
  type LogementMember,
} from "@/hooks/useLogementMembers";
import { useChecklistTemplates, useApplyChecklistTemplate, useCreateChecklistTemplate } from "@/hooks/useChecklistTemplates";
import {
  useLogementExternalCalendars,
  useCreateExternalCalendar,
  useUpdateExternalCalendar,
  useDeleteExternalCalendar,
  useSyncExternalCalendar,
  type ExternalCalendar,
  type ExternalCalendarProvider,
} from "@/hooks/useLogementExternalCalendars";
import Select from "@/components/ui/Select";
import CityAddressAutocomplete from "@/components/ui/CityAddressAutocomplete";
import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { ApiError } from "@/lib/api";

function clientDisplayName(c: { company_name?: string | null; first_name?: string | null; last_name?: string | null }) {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client sans nom";
}

const ROOM_KINDS: { value: RoomKind; label: string }[] = [
  { value: "chambre", label: "Chambre" },
  { value: "salle_de_bain", label: "Salle de bain" },
  { value: "wc", label: "WC" },
  { value: "cuisine", label: "Cuisine" },
  { value: "salon", label: "Salon" },
  { value: "salle_a_manger", label: "Salle à manger" },
  { value: "bureau", label: "Bureau" },
  { value: "entree", label: "Entrée" },
  { value: "couloir", label: "Couloir" },
  { value: "exterieur", label: "Extérieur" },
  { value: "cave", label: "Cave" },
  { value: "buanderie", label: "Buanderie" },
  { value: "autre", label: "Autre" },
];

export default function LogementSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <BackLink fallback="/logements" />
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Paramètres logement</h1>

      <InfoSection logementId={id} isAdmin={isAdmin} />
      <LogementMembersSection logementId={id} isAdmin={isAdmin} />
      <RoomsSection logementId={id} isAdmin={isAdmin} />
      <ConsommablesSection logementId={id} isAdmin={isAdmin} />
      {isAdmin ? <ExternalCalendarsSection logementId={id} /> : null}
      <MenagesLinkedSection logementId={id} />
      <TemplateSection logementId={id} isAdmin={isAdmin} />
    </div>
  );
}

function InfoSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const logement = useLogement(logementId);
  const client = useClient(logement.data?.client_id ?? undefined);
  const router = useRouter();
  const del = useDeleteLogement();
  const unarch = useUnarchiveLogement();
  const { confirm } = useDialog();
  const updateCover = useUpdateLogement(logementId);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (!file) return;
    setCoverUploading(true);
    try {
      const uploaded = await uploadFile(file);
      await updateCover.mutateAsync({
        cover_photo_url: uploaded.url,
        cover_photo_thumbnail_url: uploaded.thumbnail_url ?? uploaded.url,
      });
      toast.success("Photo de couverture mise à jour");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Archiver ce logement ?",
      description:
        "Le logement sera archivé et retiré des listes, ainsi que TOUTES les prestations qui le concernent (ménages, check-in, check-out) et ses consommables. Cette action est réversible depuis le filtre « Archivés ».",
      tone: "danger",
      confirmLabel: "Archiver",
    });
    if (!ok) return;
    try {
      const res = await del.mutateAsync(logementId);
      const n = res?.archived_menages ?? 0;
      toast.success(
        n > 0
          ? `Logement archivé (${n} prestation${n > 1 ? "s" : ""} archivée${n > 1 ? "s" : ""})`
          : "Logement archivé",
      );
      router.push("/logements");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleUnarchive = async () => {
    const ok = await confirm({
      title: "Restaurer ce logement ?",
      description:
        "Le logement et les prestations/consommables archivés avec lui seront réactivés.",
      confirmLabel: "Restaurer",
    });
    if (!ok) return;
    try {
      const res = await unarch.mutateAsync(logementId);
      const n = res?.unarchived_menages ?? 0;
      toast.success(
        n > 0
          ? `Logement restauré (${n} prestation${n > 1 ? "s" : ""} restaurée${n > 1 ? "s" : ""})`
          : "Logement restauré",
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  if (logement.isLoading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-zinc-500">Chargement…</p>
      </Card>
    );
  }
  if (logement.error || !logement.data) {
    return (
      <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
        {logement.error instanceof Error ? logement.error.message : "Logement introuvable"}
      </Card>
    );
  }
  const l = logement.data;
  const address = [l.address, l.postal_code, l.city].filter(Boolean).join(", ");

  return (
    <Card className="p-6">
      {/* Photo de couverture (affichée dans la liste des logements) */}
      <div className="relative mb-4 h-40 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        {l.cover_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.cover_photo_url} alt={l.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
            Aucune photo de couverture
          </div>
        )}
        {isAdmin ? (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-black/75 disabled:opacity-60"
            >
              <Camera size={13} />
              {coverUploading ? "Envoi…" : l.cover_photo_url ? "Changer la couverture" : "Ajouter une couverture"}
            </button>
          </>
        ) : null}
      </div>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{l.name}</h2>
          {address ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              <MapPin size={14} />
              {address}
            </p>
          ) : null}
        </div>
        {isAdmin ? (
          l.archived_at ? (
            <Button size="sm" variant="ghost" onClick={handleUnarchive} disabled={unarch.isPending}>
              <RotateCcw size={14} />
              Restaurer
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={del.isPending}>
              <Trash2 size={14} />
              Supprimer
            </Button>
          )
        ) : null}
      </div>

      {isAdmin ? (
        <LogementInfoForm logement={l} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat
              label="Client"
              value={
                l.client_id ? (
                  <Link href={`/clients/${l.client_id}`} className="text-blue-600 hover:underline">
                    {client.data ? clientDisplayName(client.data) : "…"}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Stat label="Chambres" value={l.n_bedrooms} />
            <Stat label="Salles de bain" value={l.n_bathrooms} />
            <Stat label="WC" value={l.n_wc} />
            <Stat label="Cuisines" value={l.n_kitchens} />
            <Stat label="Salons" value={l.n_living_rooms} />
            <Stat label="Extérieurs" value={l.n_exterior_spaces} />
            <Stat label="Surface" value={l.surface_m2 !== null ? `${l.surface_m2} m²` : "—"} />
            <Stat
              label="Annexes"
              value={
                [
                  l.has_basement ? "Cave" : null,
                  l.has_laundry ? "Buanderie" : null,
                  l.has_pool ? "Piscine" : null,
                  l.has_jacuzzi ? "Jacuzzi" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <Stat
              label="Prestations"
              value={
                [
                  l.enable_check_in ? "Check-in" : null,
                  l.enable_check_out ? "Check-out" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "Ménage uniquement"
              }
            />
          </dl>
          {l.notes ? (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {l.notes}
              </p>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900 dark:text-white">{value}</dd>
    </div>
  );
}

function LogementInfoForm({ logement }: { logement: Logement }) {
  const update = useUpdateLogement(logement.id);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const { t } = useI18n();
  const clients = useClients({ limit: 200 });
  const [name, setName] = useState(logement.name);
  const [clientId, setClientId] = useState<string>(logement.client_id ?? "");
  const [address, setAddress] = useState(logement.address ?? "");
  const [postalCode, setPostalCode] = useState(logement.postal_code ?? "");
  const [city, setCity] = useState(logement.city ?? "");
  const [latitude, setLatitude] = useState<number | null>(
    logement.latitude !== null ? Number(logement.latitude) : null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    logement.longitude !== null ? Number(logement.longitude) : null,
  );
  const [nBedrooms, setNBedrooms] = useState(String(logement.n_bedrooms));
  const [nBathrooms, setNBathrooms] = useState(String(logement.n_bathrooms));
  const [nWc, setNWc] = useState(String(logement.n_wc));
  const [nKitchens, setNKitchens] = useState(String(logement.n_kitchens));
  const [nLivingRooms, setNLivingRooms] = useState(String(logement.n_living_rooms));
  const [nExteriorSpaces, setNExteriorSpaces] = useState(String(logement.n_exterior_spaces));
  const [nLitSimple, setNLitSimple] = useState(String(logement.n_lit_simple ?? 0));
  const [nLitDouble, setNLitDouble] = useState(String(logement.n_lit_double ?? 0));
  const [nCanapeLit, setNCanapeLit] = useState(String(logement.n_canape_lit ?? 0));
  const [nLitAppoint, setNLitAppoint] = useState(String(logement.n_lit_appoint ?? 0));
  const [hasBasement, setHasBasement] = useState(logement.has_basement);
  const [hasLaundry, setHasLaundry] = useState(logement.has_laundry);
  const [hasPool, setHasPool] = useState(logement.has_pool);
  const [hasJacuzzi, setHasJacuzzi] = useState(logement.has_jacuzzi);
  const [enableCheckIn, setEnableCheckIn] = useState(logement.enable_check_in);
  const [enableCheckOut, setEnableCheckOut] = useState(logement.enable_check_out);
  const [surfaceM2, setSurfaceM2] = useState(
    logement.surface_m2 !== null ? String(logement.surface_m2) : "",
  );
  const [notes, setNotes] = useState(logement.notes ?? "");
  const [keySafeCode, setKeySafeCode] = useState(logement.key_safe_code ?? "");
  const toStr = (v: number | string | null | undefined) =>
    v === null || v === undefined || v === "" ? "" : String(v);
  const [defDuration, setDefDuration] = useState(toStr(logement.default_duration_min));
  const [defClientPrice, setDefClientPrice] = useState(toStr(logement.default_client_price_ht));
  const [defClientVat, setDefClientVat] = useState(toStr(logement.default_client_vat_rate));
  const [defProviderPrice, setDefProviderPrice] = useState(toStr(logement.default_provider_price));
  const [defLaundryIncluded, setDefLaundryIncluded] = useState(logement.default_laundry_included);
  const [defLaundryClient, setDefLaundryClient] = useState(toStr(logement.default_laundry_client_price_ht));
  const [defLaundryProvider, setDefLaundryProvider] = useState(toStr(logement.default_laundry_provider_price));
  const [defHoraireDebut, setDefHoraireDebut] = useState(logement.default_horaire_debut ?? "");
  const [defHoraireFin, setDefHoraireFin] = useState(logement.default_horaire_fin ?? "");
  const [color, setColor] = useState<string | null>(logement.color ?? null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  const parseInt0 = (s: string): number => {
    const n = parseInt(s, 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  };

  const buildBody = (): UpdateLogementInput | null => {
    if (!name.trim()) return null;
    const surface = surfaceM2.trim() ? parseInt(surfaceM2.trim(), 10) : null;
    if (surfaceM2.trim() && (surface === null || Number.isNaN(surface) || surface < 0)) {
      return null;
    }
    const parseMoneyOrNull = (s: string): number | null => {
      const t = s.trim();
      if (!t) return null;
      const n = parseFloat(t.replace(",", "."));
      return Number.isNaN(n) || n < 0 ? null : n;
    };
    const parseIntOrNull = (s: string): number | null => {
      const t = s.trim();
      if (!t) return null;
      const n = parseInt(t, 10);
      return Number.isNaN(n) || n < 0 ? null : n;
    };
    const normalizeTime = (s: string): string | null => {
      const t = s.trim();
      if (!t) return null;
      return /^\d{2}:\d{2}(:\d{2})?$/.test(t) ? t : null;
    };
    const body: UpdateLogementInput = {
      name: name.trim(),
      client_id: clientId || null,
      address: address.trim() || null,
      postal_code: postalCode.trim() || null,
      city: city.trim() || null,
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
      enable_check_in: enableCheckIn,
      enable_check_out: enableCheckOut,
      surface_m2: surface,
      notes: notes.trim() || null,
      key_safe_code: keySafeCode.trim() || null,
      default_duration_min: parseIntOrNull(defDuration),
      default_client_price_ht: parseMoneyOrNull(defClientPrice),
      default_client_vat_rate: parseMoneyOrNull(defClientVat),
      default_provider_price: parseMoneyOrNull(defProviderPrice),
      default_laundry_included: defLaundryIncluded,
      default_laundry_client_price_ht: defLaundryIncluded
        ? parseMoneyOrNull(defLaundryClient)
        : null,
      default_laundry_provider_price: defLaundryIncluded
        ? parseMoneyOrNull(defLaundryProvider)
        : null,
      default_horaire_debut: normalizeTime(defHoraireDebut),
      default_horaire_fin: normalizeTime(defHoraireFin),
      color: color,
    };
    return body;
  };

  // Auto-save : à chaque modification d'un champ, on enregistre (debounce 700ms).
  // On ignore le tout premier rendu (montage) pour ne pas sauver inutilement.
  const isFirstRender = useRef(true);
  const stateKey = [
    name, clientId, address, postalCode, city, latitude, longitude,
    nBedrooms, nBathrooms, nWc, nKitchens, nLivingRooms, nExteriorSpaces,
    nLitSimple, nLitDouble, nCanapeLit, nLitAppoint,
    hasBasement, hasLaundry, hasPool, hasJacuzzi, enableCheckIn, enableCheckOut,
    surfaceM2, notes, keySafeCode, color,
    defDuration, defClientPrice, defClientVat, defProviderPrice,
    defLaundryIncluded, defLaundryClient, defLaundryProvider, defHoraireDebut, defHoraireFin,
  ].join("¦");

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const body = buildBody();
    if (!body) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      update.mutate(body, {
        onSuccess: () => setSaveState("saved"),
        onError: (err) => {
          setSaveState("error");
          toast.error(err instanceof ApiError ? err.message : "Erreur");
        },
      });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  return (
    <div className="mt-2">
      <div className="mb-3 flex items-center justify-between gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Informations</h3>
        <span className="text-xs text-zinc-400">
          {saveState === "saving"
            ? "Enregistrement…"
            : saveState === "saved"
              ? "✓ Enregistré"
              : saveState === "error"
                ? "⚠ Erreur d'enregistrement"
                : "Modifs enregistrées automatiquement"}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
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
        <ClientPickerModal
          open={clientPickerOpen}
          onClose={() => setClientPickerOpen(false)}
          clients={clients.data?.data ?? []}
          selectedId={clientId}
          onSelect={(id) => {
            setClientId(id);
            setClientPickerOpen(false);
          }}
        />
        <CityAddressAutocomplete
          city={city}
          postalCode={postalCode}
          address={address}
          onCityChange={(v) => setCity(v)}
          onAddressChange={(v) => setAddress(v)}
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
          inputMode="numeric"
          type="number"
          min={0}
        />

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

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {t("logement.prestations.section")}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("logement.prestations.hint")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enableCheckIn}
                onChange={(e) => setEnableCheckIn(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t("logement.enableCheckIn")}
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enableCheckOut}
                onChange={(e) => setEnableCheckOut(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t("logement.enableCheckOut")}
            </label>
          </div>
        </div>

        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {t("beds.section")}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("beds.hintLogement")}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input label={t("beds.simple")} type="number" min={0} value={nLitSimple} onChange={(e) => setNLitSimple(e.target.value)} />
            <Input label={t("beds.double")} type="number" min={0} value={nLitDouble} onChange={(e) => setNLitDouble(e.target.value)} />
            <Input label={t("beds.sofa")} type="number" min={0} value={nCanapeLit} onChange={(e) => setNCanapeLit(e.target.value)} />
            <Input label={t("beds.extra")} type="number" min={0} value={nLitAppoint} onChange={(e) => setNLitAppoint(e.target.value)} />
          </div>
        </div>

        <Input
          label="Code boîte à clés"
          type="password"
          name="key-safe-code"
          autoComplete="new-password"
          value={keySafeCode}
          onChange={(e) => setKeySafeCode(e.target.value)}
          maxLength={50}
          placeholder="Ex. 1984"
        />

        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Code interphone, instructions, accès…"
        />

        <ColorPicker label="Couleur (calendrier)" value={color} onChange={setColor} />

        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Valeurs par défaut du ménage
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Pré-remplies à la création d&apos;un ménage pour ce logement.
          </p>

          <div className="mt-3">
            <DurationPicker label="Durée par défaut" value={defDuration} onChange={setDefDuration} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
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

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
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

          <div className="mt-4 flex items-start justify-between gap-3">
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
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
      </div>
    </div>
  );
}

function ConsommablesSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const { confirm } = useDialog();
  const consommables = useLogementConsommables(logementId);
  const create = useCreateConsommable();
  const update = useUpdateConsommable(logementId);
  const remove = useDeleteConsommable(logementId);
  const setStock = useSetConsommableStock(logementId);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ConsommableLine | null>(null);
  const [stockEditing, setStockEditing] = useState<ConsommableLine | null>(null);

  const list = consommables.data ?? [];
  const alertCount = list.filter((c) => c.needs_restock).length;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            Consommables
            {alertCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                <AlertTriangle size={10} />
                {alertCount} à racheter
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Stock mis à jour par le prestataire à chaque pointage de fin, ou directement par
            l&apos;admin (clic sur le stock). Alerte si le stock passe au niveau du seuil ou en dessous.
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            Ajouter
          </Button>
        ) : null}
      </div>

      {consommables.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : list.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {list.map((c) => (
            <li key={c.logement_consommable_id} className="flex items-center gap-3 py-3 text-sm">
              <PackageCheck
                size={16}
                className={c.needs_restock ? "text-rose-500" : "text-zinc-300"}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">{c.label}</p>
                <p className="text-xs text-zinc-500">
                  Seuil d&apos;alerte : {c.seuil_alerte}
                  {c.unit ? ` ${c.unit}` : ""}
                </p>
              </div>
              {/* Stock courant — cliquable par l'admin pour le fixer/initialiser */}
              {(() => {
                const badge =
                  c.qty === null ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-800">
                      jamais relevé
                    </span>
                  ) : c.needs_restock ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                      {c.qty}
                      {c.unit ? ` ${c.unit}` : ""} · à racheter
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {c.qty}
                      {c.unit ? ` ${c.unit}` : ""}
                    </span>
                  );
                return isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setStockEditing(c)}
                    title={c.qty === null ? "Initialiser le stock" : "Modifier le stock"}
                    className="cursor-pointer"
                  >
                    {badge}
                  </button>
                ) : (
                  badge
                );
              })()}
              {isAdmin ? (
                <>
                  <button
                    onClick={() => setEditing(c)}
                    className="text-zinc-400 hover:text-blue-600"
                    aria-label="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Supprimer le consommable "${c.label}" ?`,
                        tone: "danger",
                        confirmLabel: "Supprimer",
                      });
                      if (!ok) return;
                      try {
                        await remove.mutateAsync(c.logement_consommable_id);
                        toast.success("Consommable supprimé");
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : "Erreur");
                      }
                    }}
                    className="text-zinc-400 hover:text-rose-600"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Aucun consommable défini.</p>
      )}

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} title="Ajouter un consommable">
          <ConsommableForm
            onSubmit={(input) => create.mutateAsync({ logement_id: logementId, ...input })}
            onSuccess={() => setShowCreate(false)}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal open onClose={() => setEditing(null)} title="Modifier le consommable">
          <ConsommableForm
            initial={editing}
            onSubmit={(input) =>
              update.mutateAsync({ id: editing.logement_consommable_id, input })
            }
            onSuccess={() => setEditing(null)}
          />
        </Modal>
      ) : null}

      {stockEditing ? (
        <Modal
          open
          onClose={() => setStockEditing(null)}
          title={stockEditing.qty === null ? "Initialiser le stock" : "Modifier le stock"}
        >
          <StockForm
            line={stockEditing}
            onSubmit={(qty) =>
              setStock.mutateAsync({ id: stockEditing.logement_consommable_id, qty })
            }
            onSuccess={() => setStockEditing(null)}
          />
        </Modal>
      ) : null}
    </Card>
  );
}

function StockForm({
  line,
  onSubmit,
  onSuccess,
}: {
  line: ConsommableLine;
  onSubmit: (qty: number) => Promise<unknown>;
  onSuccess: () => void;
}) {
  const [qty, setQty] = useState(line.qty === null ? "" : String(line.qty));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = parseInt(qty, 10);
    if (Number.isNaN(n) || n < 0) {
      toast.error("Quantité invalide");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(n);
      toast.success("Stock mis à jour");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        {line.label}
        {line.unit ? ` · en ${line.unit}` : ""} — seuil d&apos;alerte : {line.seuil_alerte}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Stock actuel</span>
        <Input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="0"
          autoFocus
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" loading={saving}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function ConsommableForm({
  initial,
  onSubmit,
  onSuccess,
}: {
  initial?: ConsommableLine;
  onSubmit: (input: {
    label: string;
    unit: string | null;
    seuil_alerte: number;
  }) => Promise<unknown>;
  onSuccess: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [seuil, setSeuil] = useState(String(initial?.seuil_alerte ?? 1));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    const seuilNum = parseInt(seuil, 10);
    if (Number.isNaN(seuilNum) || seuilNum < 0) {
      toast.error("Seuil invalide");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ label: label.trim(), unit: unit.trim() || null, seuil_alerte: seuilNum });
      toast.success(initial ? "Consommable modifié" : "Consommable créé");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Nom</span>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Papier toilette" autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Unité (optionnel)</span>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="rouleaux" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Seuil d&apos;alerte</span>
          <Input type="number" min={0} value={seuil} onChange={(e) => setSeuil(e.target.value)} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" loading={saving}>
          {initial ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}

function RoomsSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const { confirm } = useDialog();
  const rooms = useLogementRooms(logementId);
  const create = useCreateLogementRoom();
  const remove = useDeleteLogementRoom();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Pièces</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ajoute des photos et gère chaque pièce du logement au même endroit.
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            Ajouter
          </Button>
        ) : null}
      </div>

      {rooms.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : rooms.data && rooms.data.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rooms.data.map((r) => (
            <RoomItem
              key={r.id}
              room={r}
              logementId={logementId}
              isAdmin={isAdmin}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Supprimer la pièce "${r.name}" ?`,
                  tone: "danger",
                  confirmLabel: "Supprimer",
                });
                if (!ok) return;
                try {
                  await remove.mutateAsync({ id: r.id, logement_id: logementId });
                  toast.success("Pièce supprimée");
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Erreur");
                }
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Aucune pièce définie.</p>
      )}

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} title="Ajouter une pièce">
          <CreateRoomForm
            logementId={logementId}
            onSuccess={() => setShowCreate(false)}
            create={create}
          />
        </Modal>
      ) : null}
    </Card>
  );
}

function CreateRoomForm({
  logementId,
  onSuccess,
  create,
}: {
  logementId: string;
  onSuccess: () => void;
  create: ReturnType<typeof useCreateLogementRoom>;
}) {
  const [kind, setKind] = useState<RoomKind | "">("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!kind) {
      toast.error("Le type est obligatoire");
      return;
    }
    if (kind === "autre" && !name.trim()) {
      toast.error("Le nom est obligatoire pour le type « Autre »");
      return;
    }
    try {
      await create.mutateAsync({
        logement_id: logementId,
        kind,
        // Le nom n'est envoyé que pour « autre » ; sinon l'API le génère depuis le type.
        name: kind === "autre" ? name.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Pièce créée");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Type</span>
        <select
          autoFocus
          className="h-10 appearance-none rounded-lg border border-zinc-200 bg-white bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pl-3 pr-9 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
          }}
          value={kind}
          onChange={(e) => setKind(e.target.value as RoomKind | "")}
        >
          <option value="">— Choisir un type —</option>
          {ROOM_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {kind === "autre" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nom de la pièce</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Notes (optionnel)</span>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onSuccess}>
          Annuler
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "…" : "Créer"}
        </Button>
      </div>
    </form>
  );
}

function TemplateSection({
  logementId,
  isAdmin,
}: {
  logementId: string;
  isAdmin: boolean;
}) {
  const { confirm } = useDialog();
  const template = useCheckTemplate(logementId);
  const createSection = useCreateTemplateSection();
  const updateSection = useUpdateTemplateSection(logementId);
  const deleteSection = useDeleteTemplateSection(logementId);
  const createItem = useCreateTemplateItem(logementId);
  const updateItem = useUpdateTemplateItem(logementId);
  const deleteItem = useDeleteTemplateItem(logementId);
  const reorderSections = useReorderTemplateSections(logementId);
  const checklistTemplates = useChecklistTemplates();
  const applyTemplate = useApplyChecklistTemplate(logementId);
  const createOrgTemplate = useCreateChecklistTemplate();
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [newItemBySection, setNewItemBySection] = useState<Record<string, string>>({});
  const [applyId, setApplyId] = useState("");
  // Édition inline + drag-and-drop des sections
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [iconPickerSection, setIconPickerSection] = useState<CheckTemplateSection | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sections = template.data ?? [];

  const saveSectionLabel = async () => {
    const id = editingSectionId;
    const label = editLabel.trim();
    setEditingSectionId(null);
    if (!id || !label) return;
    try {
      await updateSection.mutateAsync({ id, input: { label } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const saveItemLabel = async () => {
    const id = editingItemId;
    const label = editLabel.trim();
    setEditingItemId(null);
    if (!id || !label) return;
    try {
      await updateItem.mutateAsync({ id, input: { label } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleDropOnSection = (targetId: string) => {
    const sourceId = dragId;
    setDragId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const ids = sections.map((s) => s.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderSections.mutate(ids);
  };

  const handleApplyTemplate = async () => {
    if (!applyId) return;
    try {
      await applyTemplate.mutateAsync(applyId);
      setApplyId("");
      toast.success("Modèle appliqué à la checklist");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleClearAll = async () => {
    const sections = template.data ?? [];
    if (sections.length === 0) return;
    const ok = await confirm({
      title: "Vider toute la checklist personnalisée de ce logement ?",
      tone: "danger",
      confirmLabel: "Vider",
    });
    if (!ok) return;
    try {
      for (const s of sections) {
        await deleteSection.mutateAsync(s.id);
      }
      toast.success("Checklist vidée");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleSaveAsTemplate = async (e: FormEvent) => {
    e.preventDefault();
    const name = saveTemplateName.trim();
    if (!name) return;
    const payloadSections = sections.map((s) => ({
      label: s.label,
      items: s.items.map((it) => ({ label: it.label, required: it.required })),
    }));
    try {
      await createOrgTemplate.mutateAsync({ name, sections: payloadSections });
      setSaveTemplateOpen(false);
      setSaveTemplateName("");
      toast.success("Modèle d'organisation créé");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleAddSection = async (e: FormEvent) => {
    e.preventDefault();
    const label = newSectionLabel.trim();
    if (!label) return;
    try {
      await createSection.mutateAsync({ logement_id: logementId, label });
      setNewSectionLabel("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleAddItem = async (sectionId: string) => {
    const label = (newItemBySection[sectionId] ?? "").trim();
    if (!label) return;
    try {
      await createItem.mutateAsync({ section_id: sectionId, label });
      setNewItemBySection((p) => ({ ...p, [sectionId]: "" }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Checklist personnalisée
          </h2>
          {isAdmin && (template.data ?? []).length > 0 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSaveTemplateName("");
                  setSaveTemplateOpen(true);
                }}
              >
                Enregistrer comme modèle
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={deleteSection.isPending}
              >
                <Trash2 size={14} />
                Tout vider
              </Button>
            </div>
          ) : null}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Si tu définis au moins une section ici, elle sera utilisée à la création d&apos;un ménage
          (à la place du plan automatique basé sur les attributs du logement). Sinon, le plan
          automatique (basé sur les pièces/attributs) s&apos;applique.
        </p>
        {isAdmin && (checklistTemplates.data?.data ?? []).length > 0 ? (
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1 sm:max-w-xs">
              <Select
                label="Appliquer un modèle"
                value={applyId}
                onChange={(e) => setApplyId(e.target.value)}
              >
                <option value="">— Choisir un modèle —</option>
                {(checklistTemplates.data?.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.section_count} section{t.section_count > 1 ? "s" : ""})
                  </option>
                ))}
              </Select>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleApplyTemplate}
              disabled={!applyId || applyTemplate.isPending}
              loading={applyTemplate.isPending}
              className="mb-0.5"
            >
              Appliquer
            </Button>
          </div>
        ) : null}
      </div>

      {template.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div
              key={section.id}
              draggable={isAdmin && editingSectionId !== section.id}
              onDragStart={() => setDragId(section.id)}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                if (overId !== section.id) setOverId(section.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOnSection(section.id);
              }}
              className={[
                "rounded-lg border p-4 dark:border-zinc-800",
                overId === section.id && dragId && dragId !== section.id
                  ? "border-blue-400 ring-2 ring-blue-300"
                  : "border-zinc-200",
                dragId === section.id ? "opacity-50" : "",
              ].join(" ")}
            >
              <div className="mb-3 flex items-center gap-2">
                {isAdmin ? <GripVertical size={14} className="cursor-grab text-zinc-300" /> : null}
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setIconPickerSection(section)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-lg leading-none hover:border-blue-400 dark:border-zinc-700"
                    title="Choisir l'icône"
                  >
                    {section.icon || "＋"}
                  </button>
                ) : section.icon ? (
                  <span className="text-lg leading-none">{section.icon}</span>
                ) : null}
                {editingSectionId === section.id ? (
                  <Input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={saveSectionLabel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveSectionLabel();
                      }
                      if (e.key === "Escape") setEditingSectionId(null);
                    }}
                    className="flex-1"
                  />
                ) : (
                  <h3 className="flex-1 font-medium text-zinc-900 dark:text-white">{section.label}</h3>
                )}
                {isAdmin && editingSectionId !== section.id ? (
                  <>
                    <button
                      onClick={() => {
                        setEditingItemId(null);
                        setEditingSectionId(section.id);
                        setEditLabel(section.label);
                      }}
                      className="text-zinc-400 hover:text-blue-600"
                      aria-label="Renommer la section"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Supprimer "${section.label}" et tous ses items ?`,
                          tone: "danger",
                          confirmLabel: "Supprimer",
                        });
                        if (!ok) return;
                        try {
                          await deleteSection.mutateAsync(section.id);
                        } catch (err) {
                          toast.error(err instanceof ApiError ? err.message : "Erreur");
                        }
                      }}
                      className="text-zinc-400 hover:text-rose-600"
                      aria-label="Supprimer la section"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : null}
              </div>
              <ul className="mb-3 flex flex-col gap-1">
                {section.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                  >
                    {editingItemId === it.id ? (
                      <Input
                        autoFocus
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onBlur={saveItemLabel}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveItemLabel();
                          }
                          if (e.key === "Escape") setEditingItemId(null);
                        }}
                        className="flex-1"
                      />
                    ) : (
                      <span className="flex-1">• {it.label}</span>
                    )}
                    {isAdmin && editingItemId !== it.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingSectionId(null);
                            setEditingItemId(it.id);
                            setEditLabel(it.label);
                          }}
                          className="text-zinc-300 hover:text-blue-600"
                          aria-label="Renommer l'item"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteItem.mutate(it.id)}
                          className="text-zinc-300 hover:text-rose-600"
                          aria-label="Supprimer l'item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {isAdmin ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nouvel item…"
                    value={newItemBySection[section.id] ?? ""}
                    onChange={(e) =>
                      setNewItemBySection((p) => ({ ...p, [section.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddItem(section.id);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAddItem(section.id)}
                    disabled={createItem.isPending}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}

          {isAdmin ? (
            <form onSubmit={handleAddSection} className="flex gap-2">
              <Input
                placeholder="Nouvelle section (ex: Salle de bain principale)"
                value={newSectionLabel}
                onChange={(e) => setNewSectionLabel(e.target.value)}
              />
              <Button type="submit" disabled={createSection.isPending}>
                <Plus size={14} />
                Section
              </Button>
            </form>
          ) : null}

          {(template.data ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aucune section personnalisée. La checklist sera générée automatiquement.
            </p>
          ) : null}
        </div>
      )}

      {saveTemplateOpen ? (
        <Modal
          open
          onClose={() => setSaveTemplateOpen(false)}
          title="Enregistrer comme modèle d'organisation"
        >
          <form onSubmit={handleSaveAsTemplate} className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">
              Crée un modèle réutilisable (sur d&apos;autres logements) à partir des{" "}
              {sections.length} section{sections.length > 1 ? "s" : ""} de cette checklist.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nom du modèle</span>
              <Input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="Ex. Appartement T2 standard"
                autoFocus
              />
            </label>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={createOrgTemplate.isPending}>
                Créer le modèle
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {iconPickerSection ? (
        <Modal open onClose={() => setIconPickerSection(null)} title="Icône de la section">
          <div className="flex flex-wrap justify-center gap-2">
            {SECTION_EMOJIS.map((e) => {
              const active = iconPickerSection.icon === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={async () => {
                    const s = iconPickerSection;
                    setIconPickerSection(null);
                    try {
                      await updateSection.mutateAsync({ id: s.id, input: { icon: e } });
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : "Erreur");
                    }
                  }}
                  className={[
                    "flex h-12 w-12 items-center justify-center rounded-lg border text-2xl",
                    active ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-700",
                  ].join(" ")}
                >
                  {e}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={async () => {
              const s = iconPickerSection;
              setIconPickerSection(null);
              try {
                await updateSection.mutateAsync({ id: s.id, input: { icon: "" } });
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Erreur");
              }
            }}
            className="mt-4 w-full rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            Aucune icône
          </button>
        </Modal>
      ) : null}
    </Card>
  );
}

const SECTION_EMOJIS = [
  "🍳", "🛋️", "🛏️", "🚿", "🚽", "🌳", "📦", "🧺", "✨", "🧹",
  "🪣", "🧴", "🛒", "🔑", "📋", "🧼", "🚪", "🪟", "🛁", "☕",
];

function labelForKind(kind: RoomKind): string {
  return ROOM_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function RoomItem({
  room,
  logementId,
  isAdmin,
  onDelete,
}: {
  room: LogementRoom;
  logementId: string;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const { confirm } = useDialog();
  const photos = useLogementPhotos(logementId, room.id);
  const create = useCreatePhoto();
  const remove = useDeletePhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items = (photos.data?.data ?? []).filter((p) => p.logement_room_id === room.id);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      for (const file of files) {
        const uploaded = await uploadFile(file);
        await create.mutateAsync({
          logement_id: logementId,
          logement_room_id: room.id,
          url: uploaded.url,
          thumbnail_url: uploaded.thumbnail_url ?? undefined,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
          taken_at: new Date().toISOString(),
        });
      }
      toast.success(`Ajouté à ${room.name}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    }
  };

  return (
    <li className="py-3 text-sm">
      <div className="flex items-center gap-3">
        <GripVertical size={14} className="text-zinc-300" />
        <div className="flex-1">
          <p className="font-medium text-zinc-900 dark:text-white">{room.name}</p>
          {room.kind ? <p className="text-xs text-zinc-500">{labelForKind(room.kind)}</p> : null}
        </div>
        {isAdmin ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={create.isPending}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
            >
              <Camera size={12} />
              Photo
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-zinc-400 hover:text-rose-600"
              aria-label="Supprimer la pièce"
            >
              <Trash2 size={14} />
            </button>
          </>
        ) : null}
      </div>
      {items.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 pl-7 sm:grid-cols-5 lg:grid-cols-8">
          {items.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail_url ?? p.url} alt="" className="h-full w-full object-cover" />
              {isAdmin ? (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Supprimer cette photo ?",
                      tone: "danger",
                      confirmLabel: "Supprimer",
                    });
                    if (!ok) return;
                    await remove.mutateAsync(p.id);
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                  aria-label="Supprimer la photo"
                >
                  <Trash2 size={10} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function LogementMembersSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const { confirm } = useDialog();
  const members = useLogementMembers(logementId);
  const orgPrestataires = useOrgPrestataires();
  const add = useAddLogementMember();
  const remove = useRemoveLogementMember();

  const prestataires = (members.data ?? []).filter((m) => m.role === "prestataire");
  const memberIds = new Set(prestataires.map((m) => m.user_id));
  const candidates = (orgPrestataires.data ?? []).filter((u) => !memberIds.has(u.id));

  const handleAdd = async (userId: string) => {
    if (!userId) return;
    try {
      await add.mutateAsync({ logement_id: logementId, user_id: userId, role: "prestataire" });
      toast.success("Prestataire rattaché");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleRemove = async (m: LogementMember) => {
    const ok = await confirm({
      title: `Retirer ${m.first_name} ${m.last_name} de ce logement ?`,
      tone: "danger",
      confirmLabel: "Retirer",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: m.id, logement_id: logementId });
      toast.success("Prestataire retiré");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Prestataires</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Les prestataires rattachés peuvent être affectés aux ménages de ce logement.
        </p>
      </div>

      {members.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : prestataires.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {prestataires.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <Avatar firstName={m.first_name} lastName={m.last_name} src={m.avatar_url ?? undefined} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                  {m.first_name} {m.last_name}
                </p>
                <p className="truncate text-xs text-zinc-500">{m.email}</p>
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleRemove(m)}
                  className="text-zinc-400 hover:text-rose-600"
                  aria-label="Retirer du logement"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Aucun prestataire rattaché à ce logement.</p>
      )}

      {isAdmin ? (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {candidates.length > 0 ? (
            <Select
              label="Rattacher un prestataire"
              value=""
              onChange={(e) => handleAdd(e.target.value)}
              disabled={add.isPending}
            >
              <option value="">— Choisir un prestataire —</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-xs text-zinc-500">
              {orgPrestataires.isLoading
                ? "Chargement…"
                : "Tous tes prestataires sont déjà rattachés. Invite-en d'autres depuis Équipe."}
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

const EXTERNAL_CALENDAR_PROVIDERS: { value: ExternalCalendarProvider; label: string }[] = [
  { value: "airbnb", label: "Airbnb" },
  { value: "booking", label: "Booking.com" },
  { value: "vrbo", label: "Vrbo / Abritel" },
  { value: "ical", label: "Autre (iCal)" },
];

function providerLabel(p: ExternalCalendarProvider): string {
  return EXTERNAL_CALENDAR_PROVIDERS.find((o) => o.value === p)?.label ?? p;
}

/** Configuration des calendriers iCal externes (Airbnb, Booking…) — admin only. */
function ExternalCalendarsSection({ logementId }: { logementId: string }) {
  const { confirm } = useDialog();
  const calendars = useLogementExternalCalendars(logementId);
  const create = useCreateExternalCalendar();
  const update = useUpdateExternalCalendar();
  const remove = useDeleteExternalCalendar();
  const sync = useSyncExternalCalendar();

  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<ExternalCalendarProvider>("airbnb");
  const [label, setLabel] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    try {
      await create.mutateAsync({
        logement_id: logementId,
        url: url.trim(),
        provider,
        label: label.trim() || undefined,
      });
      setUrl("");
      setLabel("");
      setProvider("airbnb");
      toast.success("Calendrier ajouté");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "URL invalide ou erreur");
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const r = await sync.mutateAsync({ id, logement_id: logementId });
      if (r.error) {
        toast.error(`Synchronisation échouée : ${r.error}`);
      } else {
        toast.success(
          `Synchro OK — ${r.created_menages} créé(s), ${r.cancelled_menages} annulé(s)`,
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur de synchronisation");
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggle = async (c: ExternalCalendar) => {
    try {
      await update.mutateAsync({ id: c.id, logement_id: logementId, enabled: !c.enabled });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleRemove = async (c: ExternalCalendar) => {
    const ok = await confirm({
      title: "Supprimer ce calendrier ?",
      description: "La synchronisation s'arrête. Les ménages déjà créés ne sont pas supprimés.",
      tone: "danger",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: c.id, logement_id: logementId });
      toast.success("Calendrier supprimé");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const list = calendars.data ?? [];

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start gap-2">
        <CalendarClock size={18} className="mt-0.5 shrink-0 text-zinc-400" />
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Calendriers externes (iCal)
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Colle l&apos;URL iCal de ton annonce (Airbnb, Booking…) pour créer les ménages
            automatiquement à chaque réservation. La synchro tourne toutes les 30 min ; tu peux
            aussi la lancer à la main.
          </p>
        </div>
      </div>

      {calendars.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : list.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                  {providerLabel(c.provider)}
                  {c.label ? ` — ${c.label}` : ""}
                  {!c.enabled ? (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800">
                      désactivé
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-zinc-500" title={c.url}>
                  {c.url}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {c.last_synced_at
                    ? `Dernière synchro : ${formatDateFr(c.last_synced_at, "datetime")}`
                    : "Jamais synchronisé"}
                </p>
                {c.last_error ? (
                  <p className="mt-0.5 text-xs text-rose-600">Erreur : {c.last_error}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSync(c.id)}
                  disabled={syncingId === c.id}
                >
                  <RefreshCw size={14} className={syncingId === c.id ? "animate-spin" : ""} />
                  {syncingId === c.id ? "Synchro…" : "Synchroniser"}
                </Button>
                <button
                  type="button"
                  onClick={() => handleToggle(c)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  {c.enabled ? "Désactiver" : "Activer"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(c)}
                  className="text-zinc-400 hover:text-rose-600"
                  aria-label="Supprimer le calendrier"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          Aucun calendrier externe rattaché à ce logement.
        </p>
      )}

      <form
        onSubmit={handleAdd}
        className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-end"
      >
        <div className="sm:w-40">
          <Select
            label="Source"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ExternalCalendarProvider)}
          >
            {EXTERNAL_CALENDAR_PROVIDERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Input
            label="URL iCal"
            type="url"
            placeholder="https://www.airbnb.fr/calendar/ical/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="sm:w-44">
          <Input
            label="Libellé (optionnel)"
            placeholder="Annonce Airbnb"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <Button type="submit" loading={create.isPending} disabled={!url.trim()}>
          <Plus size={16} /> Ajouter
        </Button>
      </form>
    </Card>
  );
}

function MenagesLinkedSection({ logementId }: { logementId: string }) {
  const menages = useMenages({ logement_id: logementId, limit: 50 });
  const items = menages.data?.data ?? [];

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Ménages rattachés</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {items.length === 0 ? "Aucun ménage." : `${items.length} ménage${items.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href={`/menages/new?logement_id=${logementId}`}>
          <Button size="sm">
            <Plus size={14} />
            Nouveau
          </Button>
        </Link>
      </div>

      {menages.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : items.length === 0 ? null : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {items
            .slice()
            .sort((a, b) => b.date_prevue.slice(0, 10).localeCompare(a.date_prevue.slice(0, 10)))
            .slice(0, 10)
            .map((m) => (
              <li key={m.id}>
                <Link
                  href={`/menages/${m.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-blue-600"
                >
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-zinc-400" />
                    <span className="capitalize">{formatDateFr(m.date_prevue.slice(0, 10), "long")}</span>
                    {m.horaire_prevu ? (
                      <span className="text-zinc-400">· {m.horaire_prevu.slice(0, 5)}</span>
                    ) : null}
                  </div>
                  <StatusBadge status={m.status} />
                </Link>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}
