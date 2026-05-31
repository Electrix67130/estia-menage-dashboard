"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogementListItem } from "@/hooks/useLogementsList";

// Chargement runtime des libs map — évite que Turbopack tente de les résoudre
// au moment du build server (le module SSR ne touche jamais au code leaflet).
type LeafletModule = typeof import("leaflet");
type ReactLeafletModule = typeof import("react-leaflet");

interface Geo {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
}

function toGeo(items: LogementListItem[]): Geo[] {
  const out: Geo[] = [];
  for (const l of items) {
    const lat = typeof l.latitude === "string" ? parseFloat(l.latitude) : l.latitude;
    const lng = typeof l.longitude === "string" ? parseFloat(l.longitude) : l.longitude;
    if (lat === null || lng === null) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ id: l.id, name: l.name, address: l.address, city: l.city, lat, lng });
  }
  return out;
}

interface Props {
  logements: LogementListItem[];
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [43.6, 1.44];

const DEFAULT_WRAPPER =
  "h-[calc(100vh-12rem)] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800";

export default function LogementsMap({ logements, className }: Props) {
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

  const geo = useMemo(() => toGeo(logements), [logements]);

  const center = useMemo<[number, number]>(() => {
    if (geo.length === 0) return DEFAULT_CENTER;
    const sum = geo.reduce(
      (acc, g) => ({ lat: acc.lat + g.lat, lng: acc.lng + g.lng }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / geo.length, sum.lng / geo.length];
  }, [geo]);

  const zoom = geo.length === 0 ? 6 : geo.length === 1 ? 13 : 10;

  if (!libs) {
    return (
      <div className={className ?? DEFAULT_WRAPPER}>
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          Chargement de la carte…
        </div>
      </div>
    );
  }

  const { L, RL } = libs;
  const { MapContainer, Marker, Popup, TileLayer } = RL;

  const icon = L.icon({
    iconUrl:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
          <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 32 16 32s16-20 16-32C32 7.16 24.84 0 16 0z" fill="#275245"/>
          <circle cx="16" cy="16" r="6" fill="#fff"/>
        </svg>`,
      ),
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -42],
  });

  return (
    <div className={className ?? DEFAULT_WRAPPER}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geo.map((g) => (
          <Marker key={g.id} position={[g.lat, g.lng]} icon={icon}>
            <Popup>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-zinc-900">{g.name}</p>
                {g.address ? <p className="text-xs text-zinc-600">{g.address}</p> : null}
                {g.city ? <p className="text-xs text-zinc-600">{g.city}</p> : null}
                <Link
                  href={`/logements/${g.id}`}
                  className="mt-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  Voir le logement →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
