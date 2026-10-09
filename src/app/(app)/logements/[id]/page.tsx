"use client";

import { use, useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { Plus, Trash2, Pencil, GripVertical, MapPin, Camera, Clock, AlertTriangle, PackageCheck, RefreshCw, CalendarClock, RotateCcw, Boxes, Package, Key, Eye, EyeOff, Gift } from "lucide-react";
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
import type { TFn } from "@/i18n/translations";
import { ChevronDown, User } from "lucide-react";
import {
  useLogementPhotos,
  createPhotoRequest,
  useDeletePhoto,
} from "@/hooks/useLogementPhotos";
import { useMenages } from "@/hooks/useMenages";
import { uploadFile } from "@/lib/upload";
import { formatDateFr } from "@/lib/date-fr";
import { formatQtyUnit } from "@/lib/unit-fr";
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
import { useQueryClient } from "@tanstack/react-query";
import {
  useLogementOptions,
  useOptionSuggestions,
  useCreateLogementOption,
  useUpdateLogementOption,
  useDeleteLogementOption,
  type LogementOption,
} from "@/hooks/useLogementOptions";
import {
  useLogementCodes,
  useCodeLabelSuggestions,
  useCreateLogementCode,
  useUpdateLogementCode,
  useDeleteLogementCode,
  type LogementCode,
} from "@/hooks/useLogementCodes";
import {
  useLogementEquipements,
  useEquipementCatalog,
  useCreateEquipement,
  useUpdateEquipement,
  useDeleteEquipement,
  useBulkCreateEquipements,
  type LogementEquipement,
  type EquipementCategory,
} from "@/hooks/useLogementEquipements";
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
import LogementNotificationLevel from "@/components/logement/LogementNotificationLevel";

function clientDisplayName(
  c: { company_name?: string | null; first_name?: string | null; last_name?: string | null },
  t: TFn,
) {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || t("logementDetail.clientNoName");
}

/** Types de pièces — libellés traduits via `t(key)`. */
const ROOM_KINDS: { value: RoomKind; key: string }[] = [
  { value: "chambre", key: "logementDetail.roomKind.chambre" },
  { value: "salle_de_bain", key: "logementDetail.roomKind.salleDeBain" },
  { value: "wc", key: "logementDetail.roomKind.wc" },
  { value: "cuisine", key: "logementDetail.roomKind.cuisine" },
  { value: "salon", key: "logementDetail.roomKind.salon" },
  { value: "salle_a_manger", key: "logementDetail.roomKind.salleAManger" },
  { value: "bureau", key: "logementDetail.roomKind.bureau" },
  { value: "entree", key: "logementDetail.roomKind.entree" },
  { value: "couloir", key: "logementDetail.roomKind.couloir" },
  { value: "exterieur", key: "logementDetail.roomKind.exterieur" },
  { value: "cave", key: "logementDetail.roomKind.cave" },
  { value: "buanderie", key: "logementDetail.roomKind.buanderie" },
  { value: "autre", key: "logementDetail.roomKind.autre" },
];

export default function LogementSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <BackLink fallback="/logements" />
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("logementDetail.title")}</h1>

      <InfoSection logementId={id} isAdmin={isAdmin} />
      <AccessCodesSection logementId={id} isAdmin={isAdmin} />
      <LogementMembersSection logementId={id} isAdmin={isAdmin} />
      <RoomsSection logementId={id} isAdmin={isAdmin} />
      <EquipementsSection logementId={id} isAdmin={isAdmin} />
      <OptionsSection logementId={id} isAdmin={isAdmin} />
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
  const { t, tp } = useI18n();

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
      toast.success(t("logementDetail.coverUpdated"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setCoverUploading(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t("logementDetail.archiveTitle"),
      description: t("logementDetail.archiveDesc"),
      tone: "danger",
      confirmLabel: t("logementDetail.archiveConfirm"),
    });
    if (!ok) return;
    try {
      const res = await del.mutateAsync(logementId);
      const n = res?.archived_menages ?? 0;
      toast.success(n > 0 ? tp("logementDetail.archivedWithCount", n) : t("logementDetail.archived"));
      router.push("/logements");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  const handleUnarchive = async () => {
    const ok = await confirm({
      title: t("logementDetail.unarchiveTitle"),
      description: t("logementDetail.unarchiveDesc"),
      confirmLabel: t("logementDetail.restore"),
    });
    if (!ok) return;
    try {
      const res = await unarch.mutateAsync(logementId);
      const n = res?.unarchived_menages ?? 0;
      toast.success(n > 0 ? tp("logementDetail.restoredWithCount", n) : t("logementDetail.restored"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  if (logement.isLoading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
      </Card>
    );
  }
  if (logement.error || !logement.data) {
    return (
      <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
        {logement.error instanceof Error ? logement.error.message : t("logementDetail.notFound")}
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
            {t("logementDetail.noCover")}
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
              {coverUploading ? t("common.sending") : l.cover_photo_url ? t("logementDetail.changeCover") : t("logementDetail.addCover")}
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
              {t("logementDetail.restore")}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={del.isPending}>
              <Trash2 size={14} />
              {t("common.delete")}
            </Button>
          )
        ) : null}
      </div>

      {!l.archived_at ? (
        <div className="mb-4 border-y border-zinc-100 py-3 dark:border-zinc-800">
          <LogementNotificationLevel logementId={l.id} />
        </div>
      ) : null}

      {isAdmin ? (
        <LogementInfoForm logement={l} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat
              label={t("role.client")}
              value={
                l.client_id ? (
                  <Link href={`/clients/${l.client_id}`} className="text-blue-600 hover:underline">
                    {client.data ? clientDisplayName(client.data, t) : "…"}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Stat label={t("logement.rooms.bedrooms")} value={l.n_bedrooms} />
            <Stat label={t("logement.rooms.bathrooms")} value={l.n_bathrooms} />
            <Stat label={t("logement.rooms.wc")} value={l.n_wc} />
            <Stat label={t("logement.rooms.kitchens")} value={l.n_kitchens} />
            <Stat label={t("logement.rooms.livingRooms")} value={l.n_living_rooms} />
            <Stat label={t("logement.rooms.exteriorSpaces")} value={l.n_exterior_spaces} />
            <Stat label={t("logementDetail.surface")} value={l.surface_m2 !== null ? `${l.surface_m2} m²` : "—"} />
            <Stat
              label={t("logementDetail.annexes")}
              value={
                [
                  l.has_basement ? t("logement.rooms.basement") : null,
                  l.has_laundry ? t("logement.rooms.laundry") : null,
                  l.has_pool ? t("logement.rooms.pool") : null,
                  l.has_jacuzzi ? t("logement.rooms.jacuzzi") : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <Stat
              label={t("logement.prestations.section")}
              value={
                [
                  l.enable_check_in ? t("prestation.type.checkIn") : null,
                  l.enable_check_out ? t("prestation.type.checkOut") : null,
                ]
                  .filter(Boolean)
                  .join(", ") || t("logementDetail.menageOnly")
              }
            />
          </dl>
          {l.notes ? (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{t("logementDetail.notes")}</p>
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
  const [nLitParapluie, setNLitParapluie] = useState(String(logement.n_lit_parapluie ?? 0));
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
      n_lit_parapluie: parseInt0(nLitParapluie),
      has_basement: hasBasement,
      has_laundry: hasLaundry,
      has_pool: hasPool,
      has_jacuzzi: hasJacuzzi,
      enable_check_in: enableCheckIn,
      enable_check_out: enableCheckOut,
      surface_m2: surface,
      notes: notes.trim() || null,
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
    nLitSimple, nLitDouble, nCanapeLit, nLitAppoint, nLitParapluie,
    hasBasement, hasLaundry, hasPool, hasJacuzzi, enableCheckIn, enableCheckOut,
    surfaceM2, notes, color,
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
          toast.error(err instanceof ApiError ? err.message : t("common.error"));
        },
      });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  return (
    <div className="mt-2">
      <div className="mb-3 flex items-center justify-between gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t("logementDetail.info")}</h3>
        <span className="text-xs text-zinc-400">
          {saveState === "saving"
            ? t("common.saving")
            : saveState === "saved"
              ? t("logementDetail.saved")
              : saveState === "error"
                ? t("logementDetail.saveError")
                : t("logementDetail.autoSave")}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        <Input label={t("logementDetail.name")} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("logementDetail.clientBilling")}
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
                    t,
                  )
                : t("logementDetail.noClientPick")}
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
          label={t("logementDetail.surfaceM2")}
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
            <Input label={t("beds.crib")} type="number" min={0} value={nLitParapluie} onChange={(e) => setNLitParapluie(e.target.value)} />
          </div>
        </div>

        <Textarea
          label={t("logementDetail.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder={t("logementDetail.notesPlaceholder")}
        />

        <ColorPicker label={t("logementDetail.colorCalendar")} value={color} onChange={setColor} />

        <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {t("logementDetail.defaults.title")}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("logementDetail.defaults.hint")}
          </p>

          <div className="mt-3">
            <DurationPicker label={t("logementDetail.defaults.duration")} value={defDuration} onChange={setDefDuration} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Input
              label={t("logementDetail.defaults.slotStart")}
              type="time"
              value={defHoraireDebut}
              onChange={(e) => setDefHoraireDebut(e.target.value)}
            />
            <Input
              label={t("logementDetail.defaults.slotEnd")}
              type="time"
              value={defHoraireFin}
              onChange={(e) => setDefHoraireFin(e.target.value)}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label={t("menage.fields.clientPriceHt")}
              type="number"
              min={0}
              step="0.01"
              value={defClientPrice}
              onChange={(e) => setDefClientPrice(e.target.value)}
              placeholder={t("logementDetail.example", { value: 80 })}
            />
            <Input
              label={t("menage.fields.clientVatRate")}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={defClientVat}
              onChange={(e) => setDefClientVat(e.target.value)}
              placeholder="20"
            />
            <Input
              label={t("menage.fields.providerPrice")}
              type="number"
              min={0}
              step="0.01"
              value={defProviderPrice}
              onChange={(e) => setDefProviderPrice(e.target.value)}
              placeholder={t("logementDetail.example", { value: 50 })}
            />
          </div>

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("logementDetail.defaults.laundryTitle")}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("logementDetail.defaults.laundryHint")}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={defLaundryIncluded}
                onChange={(e) => setDefLaundryIncluded(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              {t("menage.fields.laundryIncludedShort")}
            </label>
          </div>
          {defLaundryIncluded ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={t("logementDetail.defaults.laundryClient")}
                type="number"
                min={0}
                step="0.01"
                value={defLaundryClient}
                onChange={(e) => setDefLaundryClient(e.target.value)}
                placeholder={t("logementDetail.example", { value: 15 })}
              />
              <Input
                label={t("logementDetail.defaults.laundryProvider")}
                type="number"
                min={0}
                step="0.01"
                value={defLaundryProvider}
                onChange={(e) => setDefLaundryProvider(e.target.value)}
                placeholder={t("logementDetail.example", { value: 10 })}
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
  const { t } = useI18n();

  const list = consommables.data ?? [];
  const alertCount = list.filter((c) => c.needs_restock).length;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            {t("logementDetail.consumables.title")}
            {alertCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                <AlertTriangle size={10} />
                {t("logementDetail.consumables.toRestock", { count: alertCount })}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("logementDetail.consumables.hint")}
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            {t("common.add")}
          </Button>
        ) : null}
      </div>

      {consommables.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
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
                  {t("logementDetail.consumables.threshold", { value: formatQtyUnit(c.seuil_alerte, c.unit) })}
                </p>
              </div>
              {/* Stock courant — cliquable par l'admin pour le fixer/initialiser */}
              {(() => {
                const badge =
                  c.qty === null ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-800">
                      {t("logementDetail.consumables.neverCounted")}
                    </span>
                  ) : c.needs_restock ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                      {t("logementDetail.consumables.qtyToRestock", { qty: formatQtyUnit(c.qty, c.unit) })}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {formatQtyUnit(c.qty, c.unit)}
                    </span>
                  );
                return isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setStockEditing(c)}
                    title={c.qty === null ? t("logementDetail.consumables.initStock") : t("logementDetail.consumables.editStock")}
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
                    aria-label={t("common.edit")}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("logementDetail.consumables.deleteTitle", { label: c.label }),
                        tone: "danger",
                        confirmLabel: t("common.delete"),
                      });
                      if (!ok) return;
                      try {
                        await remove.mutateAsync(c.logement_consommable_id);
                        toast.success(t("logementDetail.consumables.deleted"));
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : t("common.error"));
                      }
                    }}
                    className="text-zinc-400 hover:text-rose-600"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">{t("logementDetail.consumables.empty")}</p>
      )}

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} title={t("logementDetail.consumables.addTitle")}>
          <ConsommableForm
            onSubmit={(input) => create.mutateAsync({ logement_id: logementId, ...input })}
            onSuccess={() => setShowCreate(false)}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal open onClose={() => setEditing(null)} title={t("logementDetail.consumables.editTitle")}>
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
          title={stockEditing.qty === null ? t("logementDetail.consumables.initStock") : t("logementDetail.consumables.editStock")}
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
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = parseInt(qty, 10);
    if (Number.isNaN(n) || n < 0) {
      toast.error(t("logementDetail.invalidQuantity"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit(n);
      toast.success(t("logementDetail.consumables.stockUpdated"));
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        {line.label}
        {line.unit ? ` · ${t("logementDetail.consumables.inUnit", { unit: line.unit })}` : ""} —{" "}
        {t("logementDetail.consumables.threshold", { value: line.seuil_alerte })}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.consumables.currentStock")}</span>
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
          {t("common.save")}
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
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error(t("logementDetail.nameRequired"));
      return;
    }
    const seuilNum = parseInt(seuil, 10);
    if (Number.isNaN(seuilNum) || seuilNum < 0) {
      toast.error(t("logementDetail.consumables.invalidThreshold"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ label: label.trim(), unit: unit.trim() || null, seuil_alerte: seuilNum });
      toast.success(initial ? t("logementDetail.consumables.updated") : t("logementDetail.consumables.created"));
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.name")}</span>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("logementDetail.consumables.namePlaceholder")} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("logementDetail.consumables.unitOptional")}</span>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("logementDetail.consumables.unitPlaceholder")} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("logementDetail.consumables.thresholdLabel")}</span>
          <Input type="number" min={0} value={seuil} onChange={(e) => setSeuil(e.target.value)} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" loading={saving}>
          {initial ? t("common.save") : t("common.add")}
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
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("logement.rooms.section")}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("logementDetail.rooms.hint")}
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            {t("common.add")}
          </Button>
        ) : null}
      </div>

      {rooms.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
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
                  title: t("logementDetail.rooms.deleteTitle", { name: r.name }),
                  tone: "danger",
                  confirmLabel: t("common.delete"),
                });
                if (!ok) return;
                try {
                  await remove.mutateAsync({ id: r.id, logement_id: logementId });
                  toast.success(t("logementDetail.rooms.deleted"));
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : t("common.error"));
                }
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">{t("logementDetail.rooms.empty")}</p>
      )}

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} title={t("logementDetail.rooms.addTitle")}>
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
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!kind) {
      toast.error(t("logementDetail.rooms.typeRequired"));
      return;
    }
    if (kind === "autre" && !name.trim()) {
      toast.error(t("logementDetail.rooms.nameRequiredOther"));
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
      toast.success(t("logementDetail.rooms.created"));
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.rooms.type")}</span>
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
          <option value="">{t("logementDetail.rooms.chooseType")}</option>
          {ROOM_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {t(k.key)}
            </option>
          ))}
        </select>
      </label>
      {kind === "autre" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("logementDetail.rooms.name")}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.notesOptional")}</span>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onSuccess}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "…" : t("logementDetail.create")}
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
  const { t, tp } = useI18n();

  const sections = template.data ?? [];

  const saveSectionLabel = async () => {
    const id = editingSectionId;
    const label = editLabel.trim();
    setEditingSectionId(null);
    if (!id || !label) return;
    try {
      await updateSection.mutateAsync({ id, input: { label } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
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
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
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
      toast.success(t("logementDetail.checklist.applied"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  const handleClearAll = async () => {
    const sections = template.data ?? [];
    if (sections.length === 0) return;
    const ok = await confirm({
      title: t("logementDetail.checklist.clearTitle"),
      tone: "danger",
      confirmLabel: t("logementDetail.checklist.clearConfirm"),
    });
    if (!ok) return;
    try {
      for (const s of sections) {
        await deleteSection.mutateAsync(s.id);
      }
      toast.success(t("logementDetail.checklist.cleared"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
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
      toast.success(t("logementDetail.checklist.orgTemplateCreated"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
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
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  const handleAddItem = async (sectionId: string) => {
    const label = (newItemBySection[sectionId] ?? "").trim();
    if (!label) return;
    try {
      await createItem.mutateAsync({ section_id: sectionId, label });
      setNewItemBySection((p) => ({ ...p, [sectionId]: "" }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {t("logementDetail.checklist.title")}
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
                {t("logementDetail.checklist.saveAsTemplate")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={deleteSection.isPending}
              >
                <Trash2 size={14} />
                {t("logementDetail.checklist.clearAll")}
              </Button>
            </div>
          ) : null}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("logementDetail.checklist.hint")}
        </p>
        {isAdmin && (checklistTemplates.data?.data ?? []).length > 0 ? (
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1 sm:max-w-xs">
              <Select
                label={t("logementDetail.checklist.applyTemplate")}
                value={applyId}
                onChange={(e) => setApplyId(e.target.value)}
              >
                <option value="">{t("logementDetail.checklist.chooseTemplate")}</option>
                {(checklistTemplates.data?.data ?? []).map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tp("logementDetail.checklist.sectionCount", tpl.section_count)})
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
              {t("logementDetail.checklist.apply")}
            </Button>
          </div>
        ) : null}
      </div>

      {template.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
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
                    title={t("logementDetail.checklist.chooseIcon")}
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
                      aria-label={t("logementDetail.checklist.renameSection")}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: t("logementDetail.checklist.deleteSectionTitle", { label: section.label }),
                          tone: "danger",
                          confirmLabel: t("common.delete"),
                        });
                        if (!ok) return;
                        try {
                          await deleteSection.mutateAsync(section.id);
                        } catch (err) {
                          toast.error(err instanceof ApiError ? err.message : t("common.error"));
                        }
                      }}
                      className="text-zinc-400 hover:text-rose-600"
                      aria-label={t("logementDetail.checklist.deleteSection")}
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
                          aria-label={t("logementDetail.checklist.renameItem")}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteItem.mutate(it.id)}
                          className="text-zinc-300 hover:text-rose-600"
                          aria-label={t("logementDetail.checklist.deleteItem")}
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
                    placeholder={t("logementDetail.checklist.newItemPlaceholder")}
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
                placeholder={t("logementDetail.checklist.newSectionPlaceholder")}
                value={newSectionLabel}
                onChange={(e) => setNewSectionLabel(e.target.value)}
              />
              <Button type="submit" disabled={createSection.isPending}>
                <Plus size={14} />
                {t("logementDetail.checklist.sectionButton")}
              </Button>
            </form>
          ) : null}

          {(template.data ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">
              {t("logementDetail.checklist.emptyAuto")}
            </p>
          ) : null}
        </div>
      )}

      {saveTemplateOpen ? (
        <Modal
          open
          onClose={() => setSaveTemplateOpen(false)}
          title={t("logementDetail.checklist.saveTemplateTitle")}
        >
          <form onSubmit={handleSaveAsTemplate} className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">
              {tp("logementDetail.checklist.saveTemplateDesc", sections.length)}
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("templates.form.name")}</span>
              <Input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder={t("logementDetail.checklist.templateNamePlaceholder")}
                autoFocus
              />
            </label>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={createOrgTemplate.isPending}>
                {t("templates.form.submit")}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {iconPickerSection ? (
        <Modal open onClose={() => setIconPickerSection(null)} title={t("logementDetail.checklist.iconTitle")}>
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
                      toast.error(err instanceof ApiError ? err.message : t("common.error"));
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
                toast.error(err instanceof ApiError ? err.message : t("common.error"));
              }
            }}
            className="mt-4 w-full rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {t("logementDetail.checklist.noIcon")}
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

function labelForKind(kind: RoomKind, t: TFn): string {
  const key = ROOM_KINDS.find((k) => k.value === kind)?.key;
  return key ? t(key) : kind;
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
  const qc = useQueryClient();
  const photos = useLogementPhotos(logementId, room.id);
  const remove = useDeletePhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Progression de l'envoi en cours (sélection multiple de fichiers). */
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const { t } = useI18n();
  const items = (photos.data?.data ?? []).filter((p) => p.logement_room_id === room.id);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;

    setUploading({ done: 0, total: files.length });
    let failed = 0;
    // Chaque photo est créée dès son upload → une erreur en cours de route ne
    // fait pas perdre les précédentes. Le cache n'est invalidé qu'une fois, à la
    // fin : sinon un lot de 10 photos déclencherait 10 refetch de la galerie.
    for (let i = 0; i < files.length; i++) {
      try {
        const uploaded = await uploadFile(files[i]);
        await createPhotoRequest({
          logement_id: logementId,
          logement_room_id: room.id,
          url: uploaded.url,
          thumbnail_url: uploaded.thumbnail_url ?? undefined,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
          taken_at: new Date().toISOString(),
        });
      } catch {
        failed++;
      }
      setUploading({ done: i + 1, total: files.length });
    }

    await qc.invalidateQueries({ queryKey: ["logement-photos", logementId] });
    setUploading(null);

    if (failed === 0) {
      toast.success(
        files.length > 1
          ? t("logementDetail.rooms.photosAddedTo", { count: files.length, room: room.name })
          : t("logementDetail.rooms.addedTo", { room: room.name }),
      );
    } else if (failed === files.length) {
      toast.error(t("logementDetail.rooms.noneUploaded"));
    } else {
      toast.error(t("logementDetail.rooms.partialUpload", { ok: files.length - failed, failed }));
    }
  };

  return (
    <li className="py-3 text-sm">
      <div className="flex items-center gap-3">
        <GripVertical size={14} className="text-zinc-300" />
        <div className="flex-1">
          <p className="font-medium text-zinc-900 dark:text-white">{room.name}</p>
          {room.kind ? <p className="text-xs text-zinc-500">{labelForKind(room.kind, t)}</p> : null}
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
              disabled={!!uploading}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
            >
              <Camera size={12} />
              {uploading
                ? uploading.total > 1
                  ? t("logementDetail.rooms.uploadProgress", { done: uploading.done, total: uploading.total })
                  : t("common.sending")
                : t("logementDetail.rooms.photo")}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-zinc-400 hover:text-rose-600"
              aria-label={t("logementDetail.rooms.deleteRoom")}
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
                      title: t("photos.confirmDelete"),
                      tone: "danger",
                      confirmLabel: t("common.delete"),
                    });
                    if (!ok) return;
                    await remove.mutateAsync(p.id);
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                  aria-label={t("logementDetail.rooms.deletePhoto")}
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
  const { t } = useI18n();

  const prestataires = (members.data ?? []).filter((m) => m.role === "prestataire");
  const memberIds = new Set(prestataires.map((m) => m.user_id));
  const candidates = (orgPrestataires.data ?? []).filter((u) => !memberIds.has(u.id));

  const handleAdd = async (userId: string) => {
    if (!userId) return;
    try {
      await add.mutateAsync({ logement_id: logementId, user_id: userId, role: "prestataire" });
      toast.success(t("logementDetail.members.attached"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  const handleRemove = async (m: LogementMember) => {
    const ok = await confirm({
      title: t("logementDetail.members.removeTitle", { name: `${m.first_name} ${m.last_name}` }),
      tone: "danger",
      confirmLabel: t("logementDetail.members.remove"),
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: m.id, logement_id: logementId });
      toast.success(t("logementDetail.members.removed"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("logementDetail.members.title")}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("logementDetail.members.hint")}
        </p>
      </div>

      {members.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
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
                  aria-label={t("logementDetail.members.removeFromLogement")}
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">{t("logementDetail.members.empty")}</p>
      )}

      {isAdmin ? (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {candidates.length > 0 ? (
            <Select
              label={t("logementDetail.members.attach")}
              value=""
              onChange={(e) => handleAdd(e.target.value)}
              disabled={add.isPending}
            >
              <option value="">{t("logementDetail.members.choose")}</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-xs text-zinc-500">
              {orgPrestataires.isLoading
                ? t("common.loading")
                : t("logementDetail.members.allAttached")}
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

const EXTERNAL_CALENDAR_PROVIDERS: ExternalCalendarProvider[] = ["airbnb", "booking", "vrbo", "ical"];

/** Noms de plateformes = noms propres (non traduits) ; seul « Autre (iCal) » l'est. */
function providerLabel(p: ExternalCalendarProvider, t: TFn): string {
  switch (p) {
    case "airbnb":
      return "Airbnb";
    case "booking":
      return "Booking.com";
    case "vrbo":
      return "Vrbo / Abritel";
    case "ical":
      return t("logementDetail.calendars.providerOther");
    default:
      return p;
  }
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
  const { t, tp } = useI18n();

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
      toast.success(t("logementDetail.calendars.added"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("logementDetail.calendars.addError"));
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const r = await sync.mutateAsync({ id, logement_id: logementId });
      if (r.error) {
        toast.error(t("logementDetail.calendars.syncFailed", { error: r.error }));
      } else {
        // `fetched_events` = événements lus dans le flux. L'afficher distingue
        // « le lien ne renvoie rien » de « le flux est lu mais rien n'en sort ».
        const detail = t("logementDetail.calendars.syncDetail", {
          created: r.created_menages,
          updated: r.updated_menages,
          cancelled: r.cancelled_menages,
        });
        const lus = tp("logementDetail.calendars.eventsRead", r.fetched_events);
        if (r.fetched_events === 0) {
          toast.warning(t("logementDetail.calendars.syncEmpty"));
        } else if (r.created_menages + r.updated_menages + r.cancelled_menages === 0) {
          toast.warning(t("logementDetail.calendars.syncNoImpact", { read: lus }));
        } else {
          toast.success(t("logementDetail.calendars.syncOk", { read: lus, detail }));
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("logementDetail.calendars.syncError"));
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggle = async (c: ExternalCalendar) => {
    try {
      await update.mutateAsync({ id: c.id, logement_id: logementId, enabled: !c.enabled });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  const handleRemove = async (c: ExternalCalendar) => {
    const ok = await confirm({
      title: t("logementDetail.calendars.deleteTitle"),
      description: t("logementDetail.calendars.deleteDesc"),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: c.id, logement_id: logementId });
      toast.success(t("logementDetail.calendars.deleted"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  const list = calendars.data ?? [];

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start gap-2">
        <CalendarClock size={18} className="mt-0.5 shrink-0 text-zinc-400" />
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {t("logementDetail.calendars.title")}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("logementDetail.calendars.hint")}
          </p>
        </div>
      </div>

      {calendars.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
      ) : list.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                  {providerLabel(c.provider, t)}
                  {c.label ? ` — ${c.label}` : ""}
                  {!c.enabled ? (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800">
                      {t("logementDetail.calendars.disabled")}
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-zinc-500" title={c.url}>
                  {c.url}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {c.last_synced_at
                    ? t("logementDetail.calendars.lastSync", { date: formatDateFr(c.last_synced_at, "datetime") })
                    : t("logementDetail.calendars.neverSynced")}
                </p>
                {c.last_error ? (
                  <p className="mt-0.5 text-xs text-rose-600">{t("logementDetail.calendars.error", { error: c.last_error })}</p>
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
                  {syncingId === c.id ? t("logementDetail.calendars.syncing") : t("logementDetail.calendars.sync")}
                </Button>
                <button
                  type="button"
                  onClick={() => handleToggle(c)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  {c.enabled ? t("logementDetail.calendars.disable") : t("logementDetail.calendars.enable")}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(c)}
                  className="text-zinc-400 hover:text-rose-600"
                  aria-label={t("logementDetail.calendars.deleteAria")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          {t("logementDetail.calendars.empty")}
        </p>
      )}

      <form
        onSubmit={handleAdd}
        className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-end"
      >
        <div className="sm:w-40">
          <Select
            label={t("logementDetail.calendars.source")}
            value={provider}
            onChange={(e) => setProvider(e.target.value as ExternalCalendarProvider)}
          >
            {EXTERNAL_CALENDAR_PROVIDERS.map((o) => (
              <option key={o} value={o}>
                {providerLabel(o, t)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Input
            label={t("logementDetail.calendars.url")}
            type="url"
            placeholder="https://www.airbnb.fr/calendar/ical/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="sm:w-44">
          <Input
            label={t("logementDetail.calendars.labelOptional")}
            placeholder={t("logementDetail.calendars.labelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <Button type="submit" loading={create.isPending} disabled={!url.trim()}>
          <Plus size={16} /> {t("common.add")}
        </Button>
      </form>
    </Card>
  );
}

function MenagesLinkedSection({ logementId }: { logementId: string }) {
  const menages = useMenages({ logement_id: logementId, limit: 50 });
  const items = menages.data?.data ?? [];
  const { t, tp } = useI18n();

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("logementDetail.menages.title")}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {items.length === 0 ? t("logementDetail.menages.empty") : tp("logementDetail.menages.count", items.length)}
          </p>
        </div>
        <Link href={`/menages/new?logement_id=${logementId}`}>
          <Button size="sm">
            <Plus size={14} />
            {t("logementDetail.menages.new")}
          </Button>
        </Link>
      </div>

      {menages.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
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

/**
 * Inventaire des équipements du logement (appareil à raclette, plaque de
 * cuisson, lave-vaisselle…). Écriture admin ; lecture pour tous (le prestataire
 * doit savoir ce qu'il trouvera sur place). Groupé par famille.
 */
function EquipementsSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const { confirm } = useDialog();
  const equipements = useLogementEquipements(logementId);
  const rooms = useLogementRooms(logementId);
  const create = useCreateEquipement();
  const update = useUpdateEquipement(logementId);
  const remove = useDeleteEquipement(logementId);
  const [showCreate, setShowCreate] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [editing, setEditing] = useState<LogementEquipement | null>(null);
  const { t } = useI18n();

  const list = equipements.data ?? [];
  const total = list.reduce((sum, e) => sum + e.quantity, 0);

  // Regroupement par famille, dans l'ordre du catalogue (« Autre » en dernier).
  const groups = EQUIPEMENT_CATEGORIES.map((cat) => ({
    ...cat,
    items: list.filter((e) => (e.category ?? "autre") === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            {t("logementDetail.equipments.title")}
            {total > 0 ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {total}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("logementDetail.equipments.hint")}
          </p>
        </div>
        {isAdmin ? (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowCatalog(true)}>
              <Boxes size={14} />
              {t("logementDetail.equipments.catalog")}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              {t("common.add")}
            </Button>
          </div>
        ) : null}
      </div>

      {equipements.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
      ) : groups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.value}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {t(group.key)}
              </p>
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {group.items.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Package size={16} className="shrink-0 text-zinc-300" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {e.label}
                        {e.quantity > 1 ? (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            ×{e.quantity}
                          </span>
                        ) : null}
                      </p>
                      {e.room_name || e.notes ? (
                        <p className="truncate text-xs text-zinc-500">
                          {[e.room_name, e.notes].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => setEditing(e)}
                          className="text-zinc-400 hover:text-blue-600"
                          aria-label={t("common.edit")}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: t("logementDetail.equipments.deleteTitle", { label: e.label }),
                              tone: "danger",
                              confirmLabel: t("common.delete"),
                            });
                            if (!ok) return;
                            try {
                              await remove.mutateAsync(e.id);
                              toast.success(t("logementDetail.equipments.deleted"));
                            } catch (err) {
                              toast.error(err instanceof ApiError ? err.message : t("common.error"));
                            }
                          }}
                          className="text-zinc-400 hover:text-rose-600"
                          aria-label={t("common.delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          {t("logementDetail.equipments.empty")}
          {isAdmin ? ` ${t("logementDetail.equipments.emptyAdminHint")}` : ""}
        </p>
      )}

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} title={t("logementDetail.equipments.addTitle")}>
          <EquipementForm
            rooms={rooms.data ?? []}
            onSubmit={(input) => create.mutateAsync({ logement_id: logementId, ...input })}
            onSuccess={() => setShowCreate(false)}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal open onClose={() => setEditing(null)} title={t("logementDetail.equipments.editTitle")}>
          <EquipementForm
            initial={editing}
            rooms={rooms.data ?? []}
            onSubmit={(input) => update.mutateAsync({ id: editing.id, input })}
            onSuccess={() => setEditing(null)}
          />
        </Modal>
      ) : null}

      {showCatalog ? (
        <Modal open onClose={() => setShowCatalog(false)} title={t("logementDetail.equipments.catalogTitle")}>
          <EquipementCatalogPicker
            logementId={logementId}
            existing={list}
            onDone={() => setShowCatalog(false)}
          />
        </Modal>
      ) : null}
    </Card>
  );
}

/** Familles d'équipements — miroir de l'enum côté API ; libellés traduits via `t(key)`. */
const EQUIPEMENT_CATEGORIES: { value: EquipementCategory; key: string }[] = [
  { value: "cuisine", key: "logementDetail.equipments.category.cuisine" },
  { value: "electromenager", key: "logementDetail.equipments.category.electromenager" },
  { value: "confort", key: "logementDetail.equipments.category.confort" },
  { value: "exterieur", key: "logementDetail.equipments.category.exterieur" },
  { value: "loisirs", key: "logementDetail.equipments.category.loisirs" },
  { value: "bebe", key: "logementDetail.equipments.category.bebe" },
  { value: "securite", key: "logementDetail.equipments.category.securite" },
  { value: "autre", key: "logementDetail.equipments.category.autre" },
];

function EquipementForm({
  initial,
  rooms,
  onSubmit,
  onSuccess,
}: {
  initial?: LogementEquipement;
  rooms: LogementRoom[];
  onSubmit: (input: {
    label: string;
    category: EquipementCategory;
    quantity: number;
    logement_room_id: string | null;
    notes: string | null;
  }) => Promise<unknown>;
  onSuccess: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [category, setCategory] = useState<EquipementCategory>(initial?.category ?? "cuisine");
  const { t } = useI18n();
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [roomId, setRoomId] = useState(initial?.logement_room_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error(t("logementDetail.nameRequired"));
      return;
    }
    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty < 1) {
      toast.error(t("logementDetail.invalidQuantity"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        label: label.trim(),
        category,
        quantity: qty,
        logement_room_id: roomId || null,
        notes: notes.trim() || null,
      });
      toast.success(initial ? t("logementDetail.equipments.updated") : t("logementDetail.equipments.added"));
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.name")}</span>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("logementDetail.equipments.namePlaceholder")}
          autoFocus
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={t("logementDetail.equipments.family")}
          value={category}
          onChange={(e) => setCategory(e.target.value as EquipementCategory)}
        >
          {EQUIPEMENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {t(c.key)}
            </option>
          ))}
        </Select>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("logementDetail.equipments.quantity")}</span>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
      </div>
      <Select
        label={t("logementDetail.equipments.roomOptional")}
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        hint={t("logementDetail.equipments.roomHint")}
      >
        <option value="">{t("logementDetail.equipments.noRoom")}</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.notesOptional")}</span>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("logementDetail.equipments.notesPlaceholder")}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" loading={saving}>
          {initial ? t("common.save") : t("common.add")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Sélection multiple depuis le catalogue servi par l'API (même liste que sur
 * mobile). Les équipements déjà présents sont affichés cochés et désactivés —
 * l'API dédoublonne de toute façon.
 */
function EquipementCatalogPicker({
  logementId,
  existing,
  onDone,
}: {
  logementId: string;
  existing: LogementEquipement[];
  onDone: () => void;
}) {
  const catalog = useEquipementCatalog();
  const bulkCreate = useBulkCreateEquipements(logementId);
  const [selected, setSelected] = useState<Record<string, EquipementCategory>>({});
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const alreadyThere = new Set(existing.map((e) => e.label.trim().toLowerCase()));
  const selectedLabels = Object.keys(selected);

  const toggle = (label: string, category: EquipementCategory) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[label]) delete next[label];
      else next[label] = category;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedLabels.length === 0) return;
    setSaving(true);
    try {
      await bulkCreate.mutateAsync(
        selectedLabels.map((label) => ({ label, category: selected[label] })),
      );
      toast.success(
        selectedLabels.length > 1
          ? t("logementDetail.equipments.bulkAdded", { count: selectedLabels.length })
          : t("logementDetail.equipments.added"),
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (catalog.isLoading) return <p className="text-sm text-zinc-500">{t("common.loading")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        {t("logementDetail.equipments.catalogHint")}
      </p>
      <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
        {(catalog.data?.categories ?? [])
          .filter((c) => c.suggestions.length > 0)
          .map((cat) => (
            <div key={cat.key}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {cat.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.suggestions.map((label) => {
                  const present = alreadyThere.has(label.trim().toLowerCase());
                  const isSelected = !!selected[label];
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={present}
                      onClick={() => toggle(label, cat.key)}
                      className={
                        present
                          ? "cursor-default rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800"
                          : isSelected
                            ? "rounded-full border border-blue-500 bg-blue-500 px-3 py-1 text-xs font-medium text-white"
                            : "rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:border-blue-400 dark:border-zinc-700 dark:text-zinc-200"
                      }
                    >
                      {present ? "✓ " : ""}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          loading={saving}
          disabled={selectedLabels.length === 0}
        >
          {selectedLabels.length > 0
            ? t("logementDetail.equipments.addCount", { count: selectedLabels.length })
            : t("common.add")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Codes d'accès du logement : plusieurs codes, chacun avec son libellé libre
 * (« Boîte à clés », « Portail », « Alarme »…). Écriture admin ; lecture pour
 * qui doit entrer dans le logement. Le code est masqué par défaut, révélé au clic.
 */
function AccessCodesSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const { confirm } = useDialog();
  const codes = useLogementCodes(logementId);
  const create = useCreateLogementCode();
  const update = useUpdateLogementCode(logementId);
  const remove = useDeleteLogementCode(logementId);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<LogementCode | null>(null);
  const { t } = useI18n();

  const list = codes.data ?? [];

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            <Key size={18} className="text-zinc-400" />
            {t("logementDetail.codes.title")}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("logementDetail.codes.hint")}
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            {t("common.add")}
          </Button>
        ) : null}
      </div>

      {codes.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
      ) : list.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">{c.label}</p>
                {c.notes ? <p className="truncate text-xs text-zinc-500">{c.notes}</p> : null}
              </div>
              <SecretCode value={c.code} />
              {isAdmin ? (
                <>
                  <button
                    onClick={() => setEditing(c)}
                    className="text-zinc-400 hover:text-blue-600"
                    aria-label={t("common.edit")}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("logementDetail.codes.deleteTitle", { label: c.label }),
                        tone: "danger",
                        confirmLabel: t("common.delete"),
                      });
                      if (!ok) return;
                      try {
                        await remove.mutateAsync(c.id);
                        toast.success(t("logementDetail.codes.deleted"));
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : t("common.error"));
                      }
                    }}
                    className="text-zinc-400 hover:text-rose-600"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">{t("logementDetail.codes.empty")}</p>
      )}

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} title={t("logementDetail.codes.addTitle")}>
          <AccessCodeForm
            onSubmit={(input) => create.mutateAsync({ logement_id: logementId, ...input })}
            onSuccess={() => setShowCreate(false)}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal open onClose={() => setEditing(null)} title={t("logementDetail.codes.editTitle")}>
          <AccessCodeForm
            initial={editing}
            onSubmit={(input) => update.mutateAsync({ id: editing.id, input })}
            onSuccess={() => setEditing(null)}
          />
        </Modal>
      ) : null}
    </Card>
  );
}

/** Code masqué (•••) révélé au clic — même esprit que le champ mobile. */
function SecretCode({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setRevealed((v) => !v)}
      title={revealed ? t("logementDetail.codes.hide") : t("logementDetail.codes.reveal")}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-sm tracking-wider text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-100"
    >
      {revealed ? value : "•".repeat(Math.min(value.length, 8))}
      {revealed ? <EyeOff size={13} className="text-zinc-400" /> : <Eye size={13} className="text-zinc-400" />}
    </button>
  );
}

function AccessCodeForm({
  initial,
  onSubmit,
  onSuccess,
}: {
  initial?: LogementCode;
  onSubmit: (input: { label: string; code: string; notes: string | null }) => Promise<unknown>;
  onSuccess: () => void;
}) {
  const suggestions = useCodeLabelSuggestions();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const { t } = useI18n();
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error(t("logementDetail.labelRequired"));
      return;
    }
    if (!code.trim()) {
      toast.error(t("logementDetail.codes.codeRequired"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ label: label.trim(), code: code.trim(), notes: notes.trim() || null });
      toast.success(initial ? t("logementDetail.codes.updated") : t("logementDetail.codes.added"));
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.label")}</span>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("logementDetail.codes.labelPlaceholder")}
          maxLength={100}
          autoFocus
        />
      </label>
      {/* Suggestions : simple aide à la saisie, le libellé reste libre. */}
      <div className="flex flex-wrap gap-1.5">
        {(suggestions.data?.labels ?? []).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setLabel(s)}
            className={
              label === s
                ? "rounded-full border border-blue-500 bg-blue-500 px-2.5 py-0.5 text-xs font-medium text-white"
                : "rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 hover:border-blue-400 dark:border-zinc-700 dark:text-zinc-300"
            }
          >
            {s}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.codes.code")}</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("logementDetail.codes.codePlaceholder")}
          maxLength={100}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.notesOptional")}</span>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("logementDetail.codes.notesPlaceholder")}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" loading={saving}>
          {initial ? t("common.save") : t("common.add")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Options proposées au client sur ce logement (pack romantique, pack
 * anniversaire…). L'admin les configure ici ; sur une prestation il coche
 * celles retenues, et le prestataire les installe.
 */
function OptionsSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const { confirm } = useDialog();
  const options = useLogementOptions(logementId);
  const create = useCreateLogementOption();
  const update = useUpdateLogementOption(logementId);
  const remove = useDeleteLogementOption(logementId);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<LogementOption | null>(null);
  const { t } = useI18n();

  const list = options.data ?? [];

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
            <Gift size={18} className="text-zinc-400" />
            {t("logementDetail.options.title")}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("logementDetail.options.hint")}
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            {t("common.add")}
          </Button>
        ) : null}
      </div>

      {options.isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
      ) : list.length > 0 ? (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {list.map((o) => (
            <li key={o.id} className="flex items-start gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">{o.label}</p>
                {o.description ? (
                  <p className="text-xs text-zinc-500">{o.description}</p>
                ) : null}
              </div>
              {isAdmin ? (
                <>
                  <button
                    onClick={() => setEditing(o)}
                    className="text-zinc-400 hover:text-blue-600"
                    aria-label={t("common.edit")}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("logementDetail.options.deleteTitle", { label: o.label }),
                        description: t("logementDetail.options.deleteDesc"),
                        tone: "danger",
                        confirmLabel: t("common.delete"),
                      });
                      if (!ok) return;
                      try {
                        await remove.mutateAsync(o.id);
                        toast.success(t("logementDetail.options.deleted"));
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : t("common.error"));
                      }
                    }}
                    className="text-zinc-400 hover:text-rose-600"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">{t("logementDetail.options.empty")}</p>
      )}

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} title={t("logementDetail.options.addTitle")}>
          <OptionForm
            onSubmit={(input) => create.mutateAsync({ logement_id: logementId, ...input })}
            onSuccess={() => setShowCreate(false)}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal open onClose={() => setEditing(null)} title={t("logementDetail.options.editTitle")}>
          <OptionForm
            initial={editing}
            onSubmit={(input) => update.mutateAsync({ id: editing.id, input })}
            onSuccess={() => setEditing(null)}
          />
        </Modal>
      ) : null}
    </Card>
  );
}

function OptionForm({
  initial,
  onSubmit,
  onSuccess,
}: {
  initial?: LogementOption;
  onSubmit: (input: { label: string; description: string | null }) => Promise<unknown>;
  onSuccess: () => void;
}) {
  const suggestions = useOptionSuggestions();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error(t("logementDetail.labelRequired"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ label: label.trim(), description: description.trim() || null });
      toast.success(initial ? t("logementDetail.options.updated") : t("logementDetail.options.added"));
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.label")}</span>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("logementDetail.options.labelPlaceholder")}
          maxLength={150}
          autoFocus
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {(suggestions.data?.labels ?? []).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setLabel(s)}
            className={
              label === s
                ? "rounded-full border border-blue-500 bg-blue-500 px-2.5 py-0.5 text-xs font-medium text-white"
                : "rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 hover:border-blue-400 dark:border-zinc-700 dark:text-zinc-300"
            }
          >
            {s}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("logementDetail.options.toInstall")}</span>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("logementDetail.options.descPlaceholder")}
          rows={3}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" loading={saving}>
          {initial ? t("common.save") : t("common.add")}
        </Button>
      </div>
    </form>
  );
}
