"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CalendarMenage } from "@/hooks/useCalendarMenages";
import { logementLabel, prestataireLabel } from "@/hooks/useCalendarMenages";
import { useLogementsList } from "@/hooks/useLogementsList";
import { formatDateFr } from "@/lib/date-fr";

type LeafletModule = typeof import("leaflet");
type ReactLeafletModule = typeof import("react-leaflet");

const STATUS_COLOR: Record<CalendarMenage["status"], string> = {
  a_venir: "#0EA5E9",
  en_cours: "#F59E0B",
  termine: "#16A34A",
  valide: "#0F766E",
  annule: "#71717A",
};

const STATUS_LABEL: Record<CalendarMenage["status"], string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "Terminé",
  valide: "Validé",
  annule: "Annulé",
};

interface PlottedMenage {
  id: string;
  status: CalendarMenage["status"];
  date_prevue: string;
  horaire_prevu: string | null;
  lat: number;
  lng: number;
  logement_name: string;
  logement_address: string;
  prestataire_label: string;
}

interface Props {
  menages: CalendarMenage[];
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [46.6, 2.3];

export default function MenagesMap({ menages, className }: Props) {
  const logements = useLogementsList();
  const [libs, setLibs] = useState<{
    L: LeafletModule;
    RL: ReactLeafletModule;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("leaflet"),
      import("react-leaflet"),
      import("leaflet/dist/leaflet.css"),
    ])
      .then(([Lmod, RLmod]) => {
        if (cancelled) return;
        const L = (Lmod as { default?: LeafletModule }).default ?? (Lmod as unknown as LeafletModule);
        setLibs({ L, RL: RLmod });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load leaflet:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logementsById = useMemo(() => {
    const m = new Map<string, { latitude: number | string | null; longitude: number | string | null }>();
    for (const l of logements.data?.data ?? []) m.set(l.id, l);
    return m;
  }, [logements.data]);

  const plotted = useMemo<PlottedMenage[]>(() => {
    const out: PlottedMenage[] = [];
    for (const m of menages) {
      const l = logementsById.get(m.logement_id);
      if (!l) continue;
      const lat = typeof l.latitude === "string" ? parseFloat(l.latitude) : l.latitude;
      const lng = typeof l.longitude === "string" ? parseFloat(l.longitude) : l.longitude;
      if (lat === null || lng === null) continue;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({
        id: m.id,
        status: m.status,
        date_prevue: m.date_prevue,
        horaire_prevu: m.horaire_prevu,
        lat: lat as number,
        lng: lng as number,
        logement_name: logementLabel(m),
        logement_address: m.logement_address ?? "",
        prestataire_label: prestataireLabel(m),
      });
    }
    return out;
  }, [menages, logementsById]);

  const center = useMemo<[number, number]>(() => {
    if (plotted.length === 0) return DEFAULT_CENTER;
    const sum = plotted.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / plotted.length, sum.lng / plotted.length];
  }, [plotted]);

  const zoom = plotted.length === 0 ? 6 : plotted.length === 1 ? 13 : 10;

  const wrapperClass =
    className ??
    "h-[calc(100vh-14rem)] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800";

  if (!libs) {
    return (
      <div className={wrapperClass}>
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          Chargement de la carte…
        </div>
      </div>
    );
  }

  const { L, RL } = libs;
  const { MapContainer, Marker, Popup, TileLayer } = RL;

  const makeIcon = (color: string, letter: string) =>
    L.divIcon({
      className: "",
      html: `<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${letter}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });

  return (
    <div className={wrapperClass}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {plotted.map((p) => {
          const letter = (p.logement_name.trim()[0] || "?").toUpperCase();
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={makeIcon(STATUS_COLOR[p.status], letter)}
            >
              <Popup>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-zinc-900">{p.logement_name}</p>
                  {p.logement_address ? (
                    <p className="text-xs text-zinc-600">{p.logement_address}</p>
                  ) : null}
                  <p className="text-xs text-zinc-700">
                    {formatDateFr(p.date_prevue.slice(0, 10), "weekday")}
                    {p.horaire_prevu ? ` · ${p.horaire_prevu.slice(0, 5)}` : ""}
                  </p>
                  <p className="text-xs text-zinc-600">{p.prestataire_label}</p>
                  <span
                    className="mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                    style={{ backgroundColor: STATUS_COLOR[p.status] }}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                  <Link
                    href={`/menages/${p.id}`}
                    className="mt-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    Voir le ménage →
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
