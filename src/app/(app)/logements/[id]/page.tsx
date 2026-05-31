"use client";

import { use, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil, GripVertical, MapPin, ImagePlus, Camera, Clock } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import DurationPicker from "@/components/ui/DurationPicker";
import ColorPicker from "@/components/ui/ColorPicker";
import ClientPickerModal from "@/components/ClientPickerModal";
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
  useUpdateLogementRoom,
  type RoomKind,
} from "@/hooks/useLogementRooms";
import {
  useCheckTemplate,
  useCreateTemplateSection,
  useDeleteTemplateSection,
  useCreateTemplateItem,
  useDeleteTemplateItem,
} from "@/hooks/useCheckTemplate";
import {
  useLogement,
  useUpdateLogement,
  type Logement,
  type UpdateLogementInput,
} from "@/hooks/useLogement";
import { useClients, useClient } from "@/hooks/useClients";
import { useChecklistTemplates, useApplyChecklistTemplate } from "@/hooks/useChecklistTemplates";
import Select from "@/components/ui/Select";
import CityAddressAutocomplete from "@/components/ui/CityAddressAutocomplete";
import { useAuth } from "@/contexts/AuthContext";
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
      <Link
        href="/menages"
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        Retour
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Paramètres logement</h1>

      <InfoSection logementId={id} isAdmin={isAdmin} />
      <PhotosSection logementId={id} isAdmin={isAdmin} />
      <RoomsSection logementId={id} isAdmin={isAdmin} />
      <RoomPhotosSection logementId={id} isAdmin={isAdmin} />
      <MenagesLinkedSection logementId={id} />
      <TemplateSection logementId={id} isAdmin={isAdmin} />
    </div>
  );
}

function InfoSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const logement = useLogement(logementId);
  const client = useClient(logement.data?.client_id ?? undefined);
  const [editOpen, setEditOpen] = useState(false);

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
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={14} />
            Modifier
          </Button>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Stat
          label="Client"
          value={
            l.client_id ? (
              <Link
                href={`/clients/${l.client_id}`}
                className="text-blue-600 hover:underline"
              >
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
          label="Équipements"
          value={
            [l.has_basement ? "cave" : null, l.has_laundry ? "buanderie" : null]
              .filter(Boolean)
              .join(", ") || "—"
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

      {editOpen ? (
        <EditLogementModal
          logement={l}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
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

function EditLogementModal({ logement, onClose }: { logement: Logement; onClose: () => void }) {
  const update = useUpdateLogement(logement.id);
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
  const [hasBasement, setHasBasement] = useState(logement.has_basement);
  const [hasLaundry, setHasLaundry] = useState(logement.has_laundry);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    const surface = surfaceM2.trim() ? parseInt(surfaceM2.trim(), 10) : null;
    if (surfaceM2.trim() && (surface === null || Number.isNaN(surface) || surface < 0)) {
      toast.error("Surface invalide");
      return;
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
      has_basement: hasBasement,
      has_laundry: hasLaundry,
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
    try {
      await update.mutateAsync(body);
      toast.success("Logement mis à jour");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Modifier le logement"
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="edit-logement-form"
            loading={update.isPending}
            disabled={update.isPending}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="edit-logement-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <Input label="Chambres" type="number" min={0} value={nBedrooms} onChange={(e) => setNBedrooms(e.target.value)} />
          <Input label="Salles de bain" type="number" min={0} value={nBathrooms} onChange={(e) => setNBathrooms(e.target.value)} />
          <Input label="WC" type="number" min={0} value={nWc} onChange={(e) => setNWc(e.target.value)} />
          <Input label="Cuisines" type="number" min={0} value={nKitchens} onChange={(e) => setNKitchens(e.target.value)} />
          <Input label="Salons" type="number" min={0} value={nLivingRooms} onChange={(e) => setNLivingRooms(e.target.value)} />
          <Input label="Extérieurs" type="number" min={0} value={nExteriorSpaces} onChange={(e) => setNExteriorSpaces(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasBasement}
              onChange={(e) => setHasBasement(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Cave
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasLaundry}
              onChange={(e) => setHasLaundry(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Buanderie
          </label>
        </div>

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
      </form>
    </Modal>
  );
}

function RoomsSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
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
            Permet d&apos;associer photos et items de checklist à des pièces précises.
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
            <li
              key={r.id}
              className="flex items-center gap-3 py-3 text-sm"
            >
              <GripVertical size={14} className="text-zinc-300" />
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">{r.name}</p>
                {r.kind ? (
                  <p className="text-xs text-zinc-500">{labelForKind(r.kind)}</p>
                ) : null}
              </div>
              {isAdmin ? (
                <button
                  onClick={async () => {
                    if (!confirm(`Supprimer la pièce "${r.name}" ?`)) return;
                    try {
                      await remove.mutateAsync({ id: r.id, logement_id: logementId });
                      toast.success("Pièce supprimée");
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : "Erreur");
                    }
                  }}
                  className="text-zinc-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </li>
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
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RoomKind | "">("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    try {
      await create.mutateAsync({
        logement_id: logementId,
        name: name.trim(),
        kind: kind || undefined,
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
        <span className="font-medium">Nom de la pièce</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Type</span>
        <select
          className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={kind}
          onChange={(e) => setKind(e.target.value as RoomKind | "")}
        >
          <option value="">— Aucun —</option>
          {ROOM_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
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
  const template = useCheckTemplate(logementId);
  const createSection = useCreateTemplateSection();
  const deleteSection = useDeleteTemplateSection(logementId);
  const createItem = useCreateTemplateItem(logementId);
  const deleteItem = useDeleteTemplateItem(logementId);
  const checklistTemplates = useChecklistTemplates();
  const applyTemplate = useApplyChecklistTemplate(logementId);
  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [newItemBySection, setNewItemBySection] = useState<Record<string, string>>({});
  const [applyId, setApplyId] = useState("");

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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Checklist personnalisée
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Si tu définis au moins une section ici, elle sera utilisée à la création d&apos;un ménage
          (à la place du plan automatique basé sur les attributs du logement).
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
          {(template.data ?? []).map((section) => (
            <div
              key={section.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-zinc-900 dark:text-white">{section.label}</h3>
                {isAdmin ? (
                  <button
                    onClick={async () => {
                      if (!confirm(`Supprimer "${section.label}" et tous ses items ?`)) return;
                      try {
                        await deleteSection.mutateAsync(section.id);
                      } catch (err) {
                        toast.error(err instanceof ApiError ? err.message : "Erreur");
                      }
                    }}
                    className="text-zinc-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
              <ul className="mb-3 flex flex-col gap-1">
                {section.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between rounded px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                  >
                    <span>• {it.label}</span>
                    {isAdmin ? (
                      <button
                        onClick={() => deleteItem.mutate(it.id)}
                        className="text-zinc-300 hover:text-rose-600"
                      >
                        <Trash2 size={12} />
                      </button>
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
    </Card>
  );
}

function labelForKind(kind: RoomKind): string {
  return ROOM_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function PhotosSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const photos = useLogementPhotos(logementId);
  const create = useCreatePhoto();
  const remove = useDeletePhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const items = (photos.data?.data ?? []).filter((p) => p.logement_id === logementId && p.logement_room_id === null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      for (const file of files) {
        const uploaded = await uploadFile(file);
        await create.mutateAsync({
          logement_id: logementId,
          url: uploaded.url,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
          taken_at: new Date().toISOString(),
        });
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} ajoutée${files.length > 1 ? "s" : ""}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec upload");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette photo ?")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Photo supprimée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Photos du logement</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Photos générales (pas liées à une pièce ou un ménage).
          </p>
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
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={create.isPending}>
              <ImagePlus size={14} />
              Ajouter
            </Button>
          </>
        ) : null}
      </div>

      {photos.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune photo.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setLightbox(p.url)}
                className="block h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbnail_url ?? p.url}
                  alt={p.caption ?? ""}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                  aria-label="Supprimer la photo"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
    </Card>
  );
}

function RoomPhotosSection({ logementId, isAdmin }: { logementId: string; isAdmin: boolean }) {
  const rooms = useLogementRooms(logementId);
  const photos = useLogementPhotos(logementId);

  const photosByRoom = new Map<string, typeof photos.data extends { data: infer A } ? A : never>();
  for (const p of photos.data?.data ?? []) {
    if (p.logement_room_id) {
      const existing = (photosByRoom.get(p.logement_room_id) ?? []) as Array<typeof p>;
      existing.push(p);
      photosByRoom.set(p.logement_room_id, existing as never);
    }
  }

  if (rooms.isLoading) return null;
  const list = rooms.data ?? [];
  if (list.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Photos par pièce</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Photos rattachées à chaque pièce du logement.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {list.map((r) => (
          <RoomPhotosBlock
            key={r.id}
            logementId={logementId}
            roomId={r.id}
            roomName={r.name}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </Card>
  );
}

function RoomPhotosBlock({
  logementId,
  roomId,
  roomName,
  isAdmin,
}: {
  logementId: string;
  roomId: string;
  roomName: string;
  isAdmin: boolean;
}) {
  const photos = useLogementPhotos(logementId, roomId);
  const create = useCreatePhoto();
  const remove = useDeletePhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items = (photos.data?.data ?? []).filter((p) => p.logement_room_id === roomId);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      for (const file of files) {
        const uploaded = await uploadFile(file);
        await create.mutateAsync({
          logement_id: logementId,
          logement_room_id: roomId,
          url: uploaded.url,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
          taken_at: new Date().toISOString(),
        });
      }
      toast.success(`Ajouté à ${roomName}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{roomName}</p>
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
              Ajouter
            </button>
          </>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">Aucune photo.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
          {items.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnail_url ?? p.url} alt="" className="h-full w-full object-cover" />
              {isAdmin ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Supprimer cette photo ?")) return;
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
      )}
    </div>
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
                  <span className="text-xs uppercase tracking-wider text-zinc-500">{m.status}</span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}
