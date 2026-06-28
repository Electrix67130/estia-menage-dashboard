"use client";

import { use, useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Timer, User as UserIcon, Pencil, Trash2, CheckCircle2, ListChecks, Camera, MessageSquare, Send, Maximize2, Lock, AlertTriangle, Key, Moon } from "lucide-react";
import BackLink from "@/components/BackLink";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import PhotoLightbox from "@/components/PhotoLightbox";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { formatDateFr } from "@/lib/date-fr";
import {
  useMenageDetail,
  useEligiblePrestataires,
  useAssignPrestataire,
  useUpdateMenage,
  menageSourceLabel,
  MenageDetail,
} from "@/hooks/useMenageDetail";
import {
  useMenageCheck,
  useMenagePhotos,
  useMenageComments,
  useCreateComment,
  useValidateMenage,
  useDeleteMenage,
  type MenagePhoto,
} from "@/hooks/useMenageCheck";
import { useMenageResponses } from "@/hooks/useMenageResponses";
import { useUnreadCounts, useMarkTabViewed, type MenageTab } from "@/hooks/useMenageViews";
import {
  useMenagePrestataires,
  useSetMenagePrestataires,
} from "@/hooks/useMenagePrestataires";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { haversineMeters, formatDistance, POINTAGE_DISTANCE_WARN_M } from "@/lib/geo-distance";

const STATUS_LABEL: Record<MenageDetail["status"], string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "Terminé",
  valide: "Validé",
  annule: "Annulé",
};

const STATUS_PILL: Record<MenageDetail["status"], string> = {
  a_venir: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  en_cours: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  termine: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  valide: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  annule: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

function formatMoney(value: string | number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(num);
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  return formatDateFr(ts, "datetime");
}

export default function MenageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const detail = useMenageDetail(id);
  const menage = detail.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <BackLink fallback="/menages" />

      {detail.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : detail.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          {detail.error instanceof Error ? detail.error.message : "Erreur inconnue"}
        </Card>
      ) : menage ? (
        <>
          <Header menage={menage} isAdmin={isAdmin} />
          <PrestataireSection menage={menage} isAdmin={isAdmin} />
          <ResponsesSection menage={menage} isAdmin={isAdmin} />
          <ScheduleSection menage={menage} isAdmin={isAdmin} />
          {isAdmin ? <PointageProofSection menage={menage} /> : null}
          <BedsSection menage={menage} />
          {menage.notes_intervention ? <NotesSection notes={menage.notes_intervention} /> : null}
          <FinancialsSection menage={menage} />
          <TabsSection menage={menage} />
        </>
      ) : null}
    </div>
  );
}

function Header({ menage, isAdmin }: { menage: MenageDetail; isAdmin: boolean }) {
  const router = useRouter();
  const { confirm } = useDialog();
  const logementLabel =
    menage.logement_name ||
    [menage.logement_address, menage.logement_city].filter(Boolean).join(" ") ||
    "Logement";
  const validate = useValidateMenage(menage.id);
  const createComment = useCreateComment(menage.id);
  const remove = useDeleteMenage(menage.id);
  const update = useUpdateMenage(menage.id);
  const reportPhotos = useMenagePhotos(menage.id);
  const [validateOpen, setValidateOpen] = useState(false);
  const [validatePrice, setValidatePrice] = useState<string>("");
  const [validateComment, setValidateComment] = useState<string>("");
  const [recapLightbox, setRecapLightbox] = useState<MenagePhoto | null>(null);
  const [pointageOpen, setPointageOpen] = useState(false);

  // Pour les inputs datetime-local : ISO → "YYYY-MM-DDTHH:MM" en heure locale.
  const toLocalInput = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [arrivedAt, setArrivedAt] = useState(toLocalInput(menage.arrived_at));
  const [departedAt, setDepartedAt] = useState(toLocalInput(menage.departed_at));

  const handleForceComplete = async () => {
    const ok = await confirm({
      title: 'Marquer ce ménage comme "terminé" ?',
      description:
        "Les heures d'arrivée/départ manquantes seront remplies avec l'heure actuelle.",
      confirmLabel: "Marquer terminé",
    });
    if (!ok) return;
    const now = new Date().toISOString();
    try {
      await update.mutateAsync({
        status: "termine",
        arrived_at: menage.arrived_at ?? now,
        departed_at: menage.departed_at ?? now,
      });
      toast.success("Ménage marqué terminé");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleSavePointage = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        arrived_at: arrivedAt ? new Date(arrivedAt).toISOString() : null,
        departed_at: departedAt ? new Date(departedAt).toISOString() : null,
      });
      toast.success("Pointages mis à jour");
      setPointageOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Supprimer ce ménage ?",
      description: "Cette action est irréversible (photos, checklist, commentaires perdus).",
      tone: "danger",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync();
      toast.success("Ménage supprimé");
      router.push("/menages");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const handleValidate = async (e: FormEvent) => {
    e.preventDefault();
    const price = validatePrice.trim() ? parseFloat(validatePrice.replace(",", ".")) : undefined;
    if (validatePrice.trim() && (price === undefined || Number.isNaN(price) || price < 0)) {
      toast.error("Prix invalide");
      return;
    }
    try {
      await validate.mutateAsync(price);
      // Commentaire optionnel : posté directement dans la discussion du ménage.
      if (validateComment.trim()) {
        try {
          await createComment.mutateAsync({ content: validateComment.trim() });
        } catch {
          /* le ménage est validé : on n'échoue pas si le commentaire échoue */
        }
      }
      toast.success("Ménage validé");
      setValidateOpen(false);
      setValidatePrice("");
      setValidateComment("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const canValidate = isAdmin && (menage.status === "termine" || menage.status === "en_cours");
  const isValidated = menage.status === "valide";
  const canForceComplete = isAdmin && (menage.status === "a_venir" || menage.status === "en_cours");
  const canEditPointage = isAdmin && menage.status !== "valide";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold capitalize text-zinc-900 dark:text-white">
            {formatDateFr(menage.date_prevue.slice(0, 10), "weekday")}
          </h1>
          <Link
            href={`/logements/${menage.logement_id}`}
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-blue-600 dark:text-zinc-400"
          >
            <MapPin size={14} />
            {logementLabel}
            {menage.logement_city ? <span className="text-zinc-400"> · {menage.logement_city}</span> : null}
          </Link>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${STATUS_PILL[menage.status]}`}
          >
            {STATUS_LABEL[menage.status]}
          </span>
          {menage.needs_attention ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
              title="Jour passé sans pointage"
            >
              <AlertTriangle size={12} />
              Non pointé
            </span>
          ) : null}
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {menageSourceLabel(menage.external_source)}
          </span>
        </div>
      </div>

      <CheckinInfo menage={menage} />

      {menage.logement_key_safe_code ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
            <Key size={14} />
            Boîte à clés : <span className="font-mono tracking-wider">{menage.logement_key_safe_code}</span>
          </span>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2">
          {canForceComplete ? (
            <Button size="sm" onClick={handleForceComplete} disabled={update.isPending}>
              <CheckCircle2 size={14} />
              Marquer terminé
            </Button>
          ) : null}
          {canValidate && !isValidated ? (
            <Button size="sm" onClick={() => setValidateOpen(true)}>
              <CheckCircle2 size={14} />
              Valider le rapport
            </Button>
          ) : null}
          {canEditPointage ? (
            <Button size="sm" variant="secondary" onClick={() => setPointageOpen(true)}>
              <Clock size={14} />
              Modifier les pointages
            </Button>
          ) : null}
          <Link href={`/menages/${menage.id}/edit`}>
            <Button size="sm" variant="secondary">
              <Pencil size={14} />
              Modifier
            </Button>
          </Link>
          <Button size="sm" variant="danger" onClick={handleDelete} disabled={remove.isPending}>
            <Trash2 size={14} />
            Supprimer
          </Button>
        </div>
      ) : null}

      {validateOpen ? (
        <Modal
          open
          onClose={() => setValidateOpen(false)}
          title="Valider le rapport"
          subtitle="Tu peux ajuster le prix final si besoin."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setValidateOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                form="validate-menage-form"
                loading={validate.isPending}
                disabled={validate.isPending}
              >
                Valider
              </Button>
            </>
          }
        >
          <form id="validate-menage-form" onSubmit={handleValidate} className="flex flex-col gap-4">
            {/* Récapitulatif du rapport */}
            {(() => {
              const all = reportPhotos.data?.data ?? [];
              const degPhotos = all.filter((p) => p.is_degradation);
              const menagePhotos = all.filter((p) => !p.is_degradation);
              return (
                <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Récapitulatif du rapport</p>

                  {/* Note voyageurs */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500">Note voyageurs :</span>
                    {menage.traveler_rating != null ? (
                      <span className="text-amber-500">
                        {"★".repeat(menage.traveler_rating)}
                        <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(5 - menage.traveler_rating)}</span>
                        <span className="ml-1 text-zinc-500">{menage.traveler_rating}/5</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400">non renseignée</span>
                    )}
                  </div>

                  {/* Compartiment 1 : Dégradations */}
                  <div
                    className={
                      menage.has_degradation
                        ? "rounded-lg border border-rose-200 bg-rose-50 p-2.5 dark:border-rose-900/50 dark:bg-rose-900/20"
                        : "rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                    }
                  >
                    <p
                      className={
                        menage.has_degradation
                          ? "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300"
                          : "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500"
                      }
                    >
                      <AlertTriangle size={13} />
                      Dégradations {menage.has_degradation ? `· ${degPhotos.length}` : ""}
                    </p>
                    {menage.has_degradation ? (
                      <>
                        {menage.degradation_note ? (
                          <p className="mt-1.5 text-sm text-rose-700/90 dark:text-rose-200/90">{menage.degradation_note}</p>
                        ) : null}
                        {degPhotos.length > 0 ? (
                          <div className="mt-2 grid grid-cols-5 gap-1.5">
                            {degPhotos.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setRecapLightbox(p)}
                                className="aspect-square w-full overflow-hidden rounded border border-rose-200 transition-transform hover:scale-105 dark:border-rose-900/50"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.thumbnail_url ?? p.url} alt="" className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-rose-700/70 dark:text-rose-300/70">Aucune photo jointe.</p>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">Aucune dégradation signalée.</p>
                    )}
                  </div>

                  {/* Compartiment 2 : Photos du ménage */}
                  <div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Photos du ménage · {menagePhotos.length}
                    </p>
                    {menagePhotos.length > 0 ? (
                      <div className="mt-2 grid grid-cols-5 gap-1.5">
                        {menagePhotos.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setRecapLightbox(p)}
                            className="aspect-square w-full overflow-hidden rounded border border-zinc-200 transition-transform hover:scale-105 dark:border-zinc-800"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.thumbnail_url ?? p.url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-400">Aucune photo.</p>
                    )}
                  </div>
                </div>
              );
            })()}

            <Input
              label="Prix final (€) — optionnel"
              type="number"
              min={0}
              step="0.01"
              placeholder="Laisser vide pour garder le prix prévu"
              value={validatePrice}
              onChange={(e) => setValidatePrice(e.target.value)}
            />
            <p className="text-xs text-zinc-500">
              Si vide, le prix prestataire prévu sera utilisé.
            </p>

            <Textarea
              label="Commentaire (optionnel)"
              rows={3}
              placeholder="Sera posté directement dans la discussion du ménage…"
              value={validateComment}
              onChange={(e) => setValidateComment(e.target.value)}
            />
          </form>
        </Modal>
      ) : null}

      {/* Lightbox du récap — rendue après le modal pour passer au-dessus (même z-index, ordre DOM). */}
      <PhotoLightbox
        open={!!recapLightbox}
        onClose={() => setRecapLightbox(null)}
        photoUrl={recapLightbox?.url ?? null}
        title={recapLightbox?.is_degradation ? "Dégradation" : "Photo du ménage"}
        subtitle={recapLightbox ? formatTimestamp(recapLightbox.taken_at) : undefined}
      />

      {pointageOpen ? (
        <Modal
          open
          onClose={() => setPointageOpen(false)}
          title="Pointages (admin)"
          subtitle="Corrige les heures si le prestataire a oublié de pointer."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setPointageOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                form="pointage-menage-form"
                loading={update.isPending}
                disabled={update.isPending}
              >
                Enregistrer
              </Button>
            </>
          }
        >
          <form id="pointage-menage-form" onSubmit={handleSavePointage} className="flex flex-col gap-3">
            <Input
              label="Heure d'arrivée"
              type="datetime-local"
              value={arrivedAt}
              onChange={(e) => setArrivedAt(e.target.value)}
            />
            <Input
              label="Heure de départ"
              type="datetime-local"
              value={departedAt}
              onChange={(e) => setDepartedAt(e.target.value)}
            />
            <p className="text-xs text-zinc-500">
              Laisser un champ vide remet l&apos;heure correspondante à zéro.
            </p>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function PrestataireSection({ menage, isAdmin }: { menage: MenageDetail; isAdmin: boolean }) {
  const prestataires = useMenagePrestataires(menage.id);
  const list = prestataires.data ?? [];
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Prestataires affectés
        </h2>
        {isAdmin && menage.status !== "termine" && menage.status !== "valide" ? (
          <PrestatairePicker menage={menage} current={list} />
        ) : null}
      </div>
      {prestataires.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : list.length === 0 ? (
        <div className="flex items-center gap-3 text-zinc-500">
          <UserIcon size={20} />
          <span className="text-sm">Aucun prestataire affecté</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <Avatar
                firstName={p.first_name ?? undefined}
                lastName={p.last_name ?? undefined}
                src={p.avatar_url ?? undefined}
                size="sm"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—"}
                </p>
                {p.email ? (
                  <p className="text-xs text-zinc-500">{p.email}</p>
                ) : null}
              </div>
              {p.is_primary ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  Référent
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PrestatairePicker({
  menage,
  current,
}: {
  menage: MenageDetail;
  current: { user_id: string }[];
}) {
  const [open, setOpen] = useState(false);
  const eligible = useEligiblePrestataires(open ? menage.id : undefined);
  const setPrestas = useSetMenagePrestataires(menage.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(current.map((c) => c.user_id));

  // Re-sync state à l'ouverture pour repartir des affectations actuelles.
  const handleOpen = () => {
    setSelectedIds(current.map((c) => c.user_id));
    setOpen(true);
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    try {
      await setPrestas.mutateAsync(selectedIds);
      toast.success(
        selectedIds.length === 0
          ? "Prestataires retirés"
          : selectedIds.length === 1
            ? "Prestataire affecté"
            : `${selectedIds.length} prestataires affectés`,
      );
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Erreur";
      toast.error(message);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        {current.length > 0 ? "Modifier" : "Affecter"}
      </Button>
    );
  }

  return (
    <Modal open onClose={() => setOpen(false)} title="Affecter des prestataires">
      <div className="flex flex-col gap-3">
        {eligible.isLoading ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : (eligible.data ?? []).length === 0 ? (
          <p className="text-sm text-blue-600">
            Aucun prestataire dans ce logement. Ajoute d&apos;abord un membre avec le rôle prestataire.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {(eligible.data ?? []).map((p, idx) => {
              const checked = selectedIds.includes(p.id);
              const isPrimary = checked && selectedIds[0] === p.id;
              return (
                <li key={p.id}>
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                    htmlFor={`presta-${idx}`}
                  >
                    <input
                      id={`presta-${idx}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleId(p.id)}
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {p.first_name} {p.last_name}
                      </p>
                      <p className="text-xs text-zinc-500">{p.email}</p>
                    </div>
                    {!p.is_member ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Ponctuel
                      </span>
                    ) : null}
                    {isPrimary ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        Référent
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-zinc-500">
          Le premier coché est le <strong>référent</strong>. Les prestataires « Ponctuel » ne sont pas
          membres du logement : ils ne reçoivent que ce ménage (remplacement).
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSave} loading={setPrestas.isPending}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResponsesSection({ menage, isAdmin }: { menage: MenageDetail; isAdmin: boolean }) {
  const responses = useMenageResponses(menage.id);
  const assign = useAssignPrestataire(menage.id);
  // Plus d'affectation possible une fois le ménage terminé / validé.
  const canAssign = isAdmin && menage.status !== "termine" && menage.status !== "valide";

  if (responses.isLoading) {
    return (
      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Réponses prestataires
        </h2>
        <p className="text-sm text-zinc-500">Chargement…</p>
      </Card>
    );
  }

  const data = responses.data ?? [];
  const present = data.filter((r) => r.status === "present");
  const absent = data.filter((r) => r.status === "absent");

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Réponses prestataires
        </h2>
        <p className="text-sm text-zinc-500">Aucune réponse pour l&apos;instant.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Réponses prestataires
      </h2>
      {present.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            Disponibles ({present.length})
          </p>
          <ul className="flex flex-col gap-2">
            {present.map((r) => {
              const isAssigned = menage.prestataire_user_id === r.user_id;
              const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "—";
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-900/20"
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      firstName={r.first_name ?? undefined}
                      lastName={r.last_name ?? undefined}
                      src={r.avatar_url ?? undefined}
                      size="sm"
                    />
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {name}
                    </span>
                  </div>
                  {isAdmin && isAssigned ? (
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      Affecté
                    </span>
                  ) : canAssign && !isAssigned ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => assign.mutate(r.user_id)}
                      loading={assign.isPending}
                    >
                      Affecter
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {absent.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-600">
            Indisponibles ({absent.length})
          </p>
          <ul className="flex flex-wrap gap-2">
            {absent.map((r) => {
              const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "—";
              return (
                <li
                  key={r.id}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {name}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

interface ProofView {
  label: string;
  photoUrl: string;
  lat: number | null;
  lng: number | null;
  at: string | null;
  distance: number | null;
}

function PointageProofSection({ menage }: { menage: MenageDetail }) {
  const [lightbox, setLightbox] = useState<ProofView | null>(null);
  const photos = useMenagePhotos(menage.id);
  const degradationPhotos = (photos.data?.data ?? []).filter((p) => p.is_degradation);
  if (!menage.arrival_photo_url && !menage.departure_photo_url) return null;
  const logLat = menage.logement_latitude != null ? Number(menage.logement_latitude) : null;
  const logLng = menage.logement_longitude != null ? Number(menage.logement_longitude) : null;

  const buildProof = (
    label: string,
    photoUrl: string | null,
    lat: string | number | null,
    lng: string | number | null,
    at: string | null,
  ): ProofView | null => {
    if (!photoUrl) return null;
    const pLat = lat != null ? Number(lat) : null;
    const pLng = lng != null ? Number(lng) : null;
    const distance =
      logLat != null && logLng != null && pLat != null && pLng != null
        ? haversineMeters(logLat, logLng, pLat, pLng)
        : null;
    return { label, photoUrl, lat: pLat, lng: pLng, at, distance };
  };

  const renderProof = (proof: ProofView | null) => {
    if (!proof) return null;
    const tooFar = proof.distance != null && proof.distance > POINTAGE_DISTANCE_WARN_M;
    return (
      <div className="flex-1">
        <p className="mb-1 text-xs font-semibold text-zinc-500">
          {proof.label}
          {proof.at ? ` · ${formatDateFr(proof.at, "time")}` : ""}
        </p>
        <button
          type="button"
          onClick={() => setLightbox(proof)}
          className="group relative block w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proof.photoUrl}
            alt={proof.label}
            className="h-44 w-full object-cover transition-transform group-hover:scale-105"
          />
          <span className="absolute bottom-1 right-1 rounded bg-black/60 p-1 text-white">
            <Maximize2 size={14} />
          </span>
        </button>
        {proof.distance != null ? (
          <span
            className={cn(
              "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
              tooFar
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
            )}
          >
            {tooFar ? "⚠ " : "✓ "}
            {formatDistance(proof.distance)} du logement
          </span>
        ) : (
          <span className="mt-2 inline-block text-xs text-zinc-400">Distance indisponible</span>
        )}
      </div>
    );
  };

  const arrival = buildProof("Arrivée", menage.arrival_photo_url, menage.arrival_lat, menage.arrival_lng, menage.arrived_at);
  const departure = buildProof("Départ", menage.departure_photo_url, menage.departure_lat, menage.departure_lng, menage.departed_at);

  return (
    <Card className="p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Preuve de présence
      </h2>
      <div className="flex flex-col gap-4 sm:flex-row">
        {renderProof(arrival)}
        {renderProof(departure)}
      </div>

      {/* Déclaration d'arrivée : note voyageurs + dégradation */}
      {menage.traveler_rating != null || menage.has_degradation ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {menage.traveler_rating != null ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Note des voyageurs :</span>
              <span className="text-amber-500">
                {"★".repeat(menage.traveler_rating)}
                <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(5 - menage.traveler_rating)}</span>
              </span>
              <span className="text-zinc-500">{menage.traveler_rating}/5</span>
            </div>
          ) : null}
          {menage.has_degradation ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-900/20">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300">
                <AlertTriangle size={14} />
                Dégradation déclarée à l&apos;arrivée
              </p>
              {menage.degradation_note ? (
                <p className="mt-1 text-sm text-rose-700/90 dark:text-rose-200/90">{menage.degradation_note}</p>
              ) : null}
              {degradationPhotos.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {degradationPhotos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setLightbox({ label: "Dégradation", photoUrl: p.url, at: p.taken_at, lat: null, lng: null, distance: null })
                      }
                      className="relative aspect-square overflow-hidden rounded border border-rose-200 dark:border-rose-900/50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumbnail_url ?? p.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <PhotoLightbox
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        photoUrl={lightbox?.photoUrl ?? null}
        title={lightbox ? `Pointage — ${lightbox.label}` : undefined}
        subtitle={
          lightbox?.at
            ? new Date(lightbox.at).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined
        }
        footer={
          lightbox?.lat != null && lightbox?.lng != null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2 text-sm text-white">
              <span>
                📍 {lightbox.lat.toFixed(5)}, {lightbox.lng.toFixed(5)}
                {lightbox.distance != null ? ` · ${formatDistance(lightbox.distance)} du logement` : ""}
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${lightbox.lat},${lightbox.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-300 hover:underline"
              >
                Ouvrir dans Google Maps →
              </a>
            </div>
          ) : lightbox ? (
            <p className="text-sm text-white/60">Coordonnées GPS indisponibles pour cette photo.</p>
          ) : null
        }
      />
    </Card>
  );
}

function ScheduleSection({ menage, isAdmin }: { menage: MenageDetail; isAdmin: boolean }) {
  const { confirm } = useDialog();
  const [editing, setEditing] = useState<"arrived_at" | "departed_at" | null>(null);
  const unlock = useUpdateMenage(menage.id);
  const handleUnlock = async () => {
    const ok = await confirm({
      title: "Déverrouiller la date ?",
      description: "La prochaine synchronisation iCal pourra écraser cette date.",
      confirmLabel: "Déverrouiller",
    });
    if (!ok) return;
    try {
      await unlock.mutateAsync({ date_locked: false });
      toast.success("Date déverrouillée");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Planification
      </h2>
      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <Row icon={<Clock size={16} />} label="Date prévue">
          <span className="inline-flex items-center gap-1.5">
            {formatDateFr(menage.date_prevue.slice(0, 10), "long")}
            {menage.horaire_prevu ? ` à ${menage.horaire_prevu.slice(0, 5)}` : ""}
            {menage.date_locked ? (
              isAdmin ? (
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={unlock.isPending}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
                  title="Cliquer pour déverrouiller — la sync iCal pourra à nouveau écraser la date"
                >
                  <Lock size={12} /> Verrouillée
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  title="Date verrouillée — la sync iCal ne l'écrasera pas"
                >
                  <Lock size={12} /> Verrouillée
                </span>
              )
            ) : null}
          </span>
        </Row>
        <Row icon={<Timer size={16} />} label="Durée estimée">
          {menage.duree_estimee_min ? `${menage.duree_estimee_min} min` : "—"}
        </Row>
        <Row icon={<Clock size={16} />} label="Arrivée prestataire">
          <span className="inline-flex items-center gap-2">
            {formatTimestamp(menage.arrived_at)}
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setEditing("arrived_at")}
                className="text-blue-600 hover:text-blue-700"
                aria-label="Modifier l'arrivée"
              >
                <Pencil size={12} />
              </button>
            ) : null}
          </span>
        </Row>
        <Row icon={<Clock size={16} />} label="Départ prestataire">
          <span className="inline-flex items-center gap-2">
            {formatTimestamp(menage.departed_at)}
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setEditing("departed_at")}
                className="text-blue-600 hover:text-blue-700"
                aria-label="Modifier le départ"
              >
                <Pencil size={12} />
              </button>
            ) : null}
          </span>
        </Row>
        {menage.validated_at ? (
          <Row icon={<Clock size={16} />} label="Validé">
            {formatTimestamp(menage.validated_at)}
          </Row>
        ) : null}
      </dl>
      {editing ? (
        <EditTimestampModal
          menageId={menage.id}
          field={editing}
          currentValue={menage[editing]}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}

function EditTimestampModal({
  menageId,
  field,
  currentValue,
  onClose,
}: {
  menageId: string;
  field: "arrived_at" | "departed_at";
  currentValue: string | null;
  onClose: () => void;
}) {
  const update = useUpdateMenage(menageId);
  const [value, setValue] = useState<string>(toLocalDatetimeInput(currentValue));
  const label = field === "arrived_at" ? "Arrivée" : "Départ";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const iso = value ? new Date(value).toISOString() : null;
      await update.mutateAsync({ [field]: iso });
      toast.success(`${label} mis à jour`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur de mise à jour");
    }
  };

  const handleClear = async () => {
    try {
      await update.mutateAsync({ [field]: null });
      toast.success(`${label} effacé`);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  return (
    <Modal open onClose={onClose} title={`Modifier l'heure de ${label.toLowerCase()}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          {currentValue ? (
            <Button type="button" variant="ghost" onClick={handleClear}>
              Effacer
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={update.isPending} disabled={!value}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NotesSection({ notes }: { notes: string }) {
  return (
    <Card className="p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Notes d&apos;intervention
      </h2>
      <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{notes}</p>
    </Card>
  );
}

function BedsSection({ menage }: { menage: MenageDetail }) {
  const { t } = useI18n();
  const total =
    (menage.n_lit_simple ?? 0) +
    (menage.n_lit_double ?? 0) +
    (menage.n_canape_lit ?? 0) +
    (menage.n_lit_appoint ?? 0);
  if (total === 0) return null;
  const cell = "flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40";
  const items: { value: number; label: string }[] = [
    { value: menage.n_lit_simple ?? 0, label: t("beds.simple") },
    { value: menage.n_lit_double ?? 0, label: t("beds.double") },
    { value: menage.n_canape_lit ?? 0, label: t("beds.sofa") },
    { value: menage.n_lit_appoint ?? 0, label: t("beds.extra") },
  ];
  return (
    <Card className="p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        {t("beds.section")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className={cell}>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">
              {it.value}
            </span>
            <span className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{it.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FinancialsSection({ menage }: { menage: MenageDetail }) {
  const hasClientFields = menage.client_price_ht !== undefined;
  const hasProviderField = menage.provider_price !== undefined;
  if (!hasClientFields && !hasProviderField) return null;

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Tarifs
      </h2>
      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        {hasClientFields ? (
          <>
            <Row label="Prix client HT">{formatMoney(menage.client_price_ht, menage.currency)}</Row>
            <Row label="TVA">
              {menage.client_vat_rate !== null && menage.client_vat_rate !== undefined
                ? `${menage.client_vat_rate}%`
                : "—"}
            </Row>
          </>
        ) : null}
        {hasProviderField ? (
          <Row label="Prix prestataire">{formatMoney(menage.provider_price, menage.currency)}</Row>
        ) : null}
        {menage.laundry_included ? (
          <>
            <Row label="Linge inclus">Oui</Row>
            {hasClientFields ? (
              <Row label="Linge — prix client HT">
                {formatMoney(menage.laundry_client_price_ht, menage.currency)}
              </Row>
            ) : null}
            {hasProviderField ? (
              <Row label="Linge — prix prestataire">
                {formatMoney(menage.laundry_provider_price, menage.currency)}
              </Row>
            ) : null}
          </>
        ) : null}
      </dl>
    </Card>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-zinc-900 dark:text-white">{children}</dd>
    </div>
  );
}

type TabKey = "check" | "photos" | "comments";

// Onglet → catégorie de non-lus correspondante (les commentaires d'étapes
// vivent dans la checklist).
const TAB_UNREAD: Record<TabKey, MenageTab> = {
  check: "comments_steps",
  photos: "photos",
  comments: "comments",
};

function CheckinInfo({ menage }: { menage: MenageDetail }) {
  const checkin = menage.next_checkin_at ? menage.next_checkin_at.slice(0, 10) : null;
  const nights = menage.stay_nights ?? null;
  if (!checkin && !nights) return null;
  const d = menage.date_prevue.slice(0, 10);

  let checkinClass =
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300";
  let checkinText = checkin ? `Prochain check-in : ${formatDateFr(checkin, "weekday")}` : "";
  if (checkin && d > checkin) {
    checkinClass =
      "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300";
    checkinText = `Planifié après le prochain check-in (${formatDateFr(checkin, "weekday")})`;
  } else if (checkin && d === checkin) {
    checkinClass =
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
    checkinText = `Rotation le jour même · check-in ${formatDateFr(checkin, "weekday")}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {checkin ? (
        <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium", checkinClass)}>
          {checkin && d > checkin ? <AlertTriangle size={14} /> : <Key size={14} />}
          {checkinText}
        </span>
      ) : null}
      {nights ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          <Moon size={14} />
          Séjour : {nights} nuit{nights > 1 ? "s" : ""}
        </span>
      ) : null}
    </div>
  );
}

function TabsSection({ menage }: { menage: MenageDetail }) {
  const [tab, setTab] = useState<TabKey>("check");
  const counts = useUnreadCounts(menage.id);
  const markViewed = useMarkTabViewed();
  const tabs: { key: TabKey; label: string; icon: typeof ListChecks }[] = [
    { key: "check", label: "Checklist", icon: ListChecks },
    { key: "photos", label: "Photos", icon: Camera },
    { key: "comments", label: "Commentaires", icon: MessageSquare },
  ];

  // Marque l'onglet ouvert comme lu → vide la pastille correspondante (et le
  // total dans la sidebar / la liste).
  useEffect(() => {
    markViewed.mutate({ menage_id: menage.id, tab: TAB_UNREAD[tab] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, menage.id]);

  const unreadFor = (key: TabKey): number => {
    const d = counts.data;
    if (!d) return 0;
    if (key === "comments") return d.comments;
    if (key === "photos") return d.photos;
    return d.comments_steps;
  };

  return (
    <Card className="p-0">
      <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          const unread = unreadFor(t.key);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              <Icon size={16} />
              {t.label}
              {unread > 0 && !active ? (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {tab === "check" ? <ChecklistTab menageId={menage.id} /> : null}
        {tab === "photos" ? <PhotosTab menageId={menage.id} /> : null}
        {tab === "comments" ? <CommentsTab menageId={menage.id} /> : null}
      </div>
    </Card>
  );
}

function ChecklistTab({ menageId }: { menageId: string }) {
  const check = useMenageCheck(menageId);

  if (check.isLoading) return <p className="text-sm text-zinc-500">Chargement…</p>;
  if (check.error)
    return (
      <p className="text-sm text-rose-600">
        {check.error instanceof Error ? check.error.message : "Erreur"}
      </p>
    );
  const sections = check.data ?? [];
  if (sections.length === 0) {
    return <p className="text-sm text-zinc-500">Aucune checklist pour ce ménage.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((s) => (
        <div key={s.id}>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
            {s.section_label}
          </h3>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {s.items.map((it) => {
              const isChecked = !!it.validated_at;
              return (
                <li key={it.id} className="flex items-start gap-3 py-2">
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border",
                      isChecked
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-zinc-300 dark:border-zinc-700",
                    )}
                  >
                    {isChecked ? <CheckCircle2 size={12} /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        isChecked
                          ? "text-zinc-500 line-through dark:text-zinc-500"
                          : "text-zinc-900 dark:text-zinc-100",
                      )}
                    >
                      {it.item_label}
                    </p>
                    {it.comment ? (
                      <p className="mt-0.5 text-xs text-zinc-500">{it.comment}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PhotosTab({ menageId }: { menageId: string }) {
  const photos = useMenagePhotos(menageId);
  const check = useMenageCheck(menageId);
  const [lightbox, setLightbox] = useState<MenagePhoto | null>(null);

  if (photos.isLoading) return <p className="text-sm text-zinc-500">Chargement…</p>;
  if (photos.error)
    return (
      <p className="text-sm text-rose-600">
        {photos.error instanceof Error ? photos.error.message : "Erreur"}
      </p>
    );

  const items = photos.data?.data ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Aucune photo pour ce ménage.</p>;
  }

  // Regroupe les photos par pièce (section de checklist), dans l'ordre des
  // sections, avec un groupe final « Non classées » pour les photos sans section.
  const sections = check.data ?? [];
  const groups: { id: string; label: string; photos: typeof items }[] = [];
  for (const s of sections) {
    const sectionPhotos = items.filter((p) => p.section_id === s.id);
    if (sectionPhotos.length > 0) {
      groups.push({ id: s.id, label: s.section_label, photos: sectionPhotos });
    }
  }
  const unclassified = items.filter((p) => !p.section_id);
  if (unclassified.length > 0) {
    groups.push({ id: "__none__", label: "Non classées", photos: unclassified });
  }

  const renderGrid = (list: typeof items) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setLightbox(p)}
          className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.thumbnail_url ?? p.url}
            alt={p.caption ?? ""}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          {/* Horodatage de prise — incrusté en bas de la vignette */}
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
            {formatTimestamp(p.taken_at)}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <div key={g.id}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {g.label} · {g.photos.length}
            </h3>
            {renderGrid(g.photos)}
          </div>
        ))}
      </div>
      <PhotoLightbox
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        photoUrl={lightbox?.url ?? null}
        title={lightbox ? formatTimestamp(lightbox.taken_at) : undefined}
        subtitle={
          lightbox && (lightbox.first_name || lightbox.last_name)
            ? `Par ${lightbox.first_name ?? ""} ${lightbox.last_name ?? ""}`.trim()
            : undefined
        }
      />
    </>
  );
}

function CommentsTab({ menageId }: { menageId: string }) {
  const { user } = useAuth();
  const comments = useMenageComments(menageId);
  const create = useCreateComment(menageId);
  const [draft, setDraft] = useState("");

  const handleSend = async () => {
    if (!draft.trim()) return;
    try {
      await create.mutateAsync({ content: draft.trim() });
      setDraft("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  if (comments.isLoading) return <p className="text-sm text-zinc-500">Chargement…</p>;
  if (comments.error)
    return (
      <p className="text-sm text-rose-600">
        {comments.error instanceof Error ? comments.error.message : "Erreur"}
      </p>
    );

  const items = comments.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucun commentaire.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => {
            const isOwn = c.author_id === user?.id;
            return (
              <li
                key={c.id}
                className={cn(
                  "flex gap-3",
                  isOwn ? "flex-row-reverse" : "flex-row",
                )}
              >
                <Avatar
                  firstName={c.first_name}
                  lastName={c.last_name}
                  src={c.avatar_url}
                  size="sm"
                />
                <div className={cn("min-w-0 max-w-[80%] rounded-lg px-3 py-2", isOwn ? "bg-blue-100 dark:bg-blue-900/30" : "bg-zinc-100 dark:bg-zinc-800")}>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-900 dark:text-zinc-100">
                    {c.content}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {formatDateFr(c.created_at, "datetime")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
      >
        <div className="flex-1">
          <Input
            placeholder="Écrire un commentaire…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!draft.trim() || create.isPending} loading={create.isPending}>
          <Send size={14} />
        </Button>
      </form>
    </div>
  );
}

