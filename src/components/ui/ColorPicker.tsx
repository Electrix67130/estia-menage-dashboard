"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  value: string | null;
  onChange: (color: string | null) => void;
}

export const LOGEMENT_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
  "#EC4899", "#F43F5E", "#D97706", "#65A30D", "#0891B2",
] as const;

type HSV = { h: number; s: number; v: number };

function hexToHsv(hex: string): HSV {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.round((n + m) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isValidHex(s: string | null): s is string {
  return !!s && /^#[0-9a-fA-F]{6}$/.test(s);
}

export default function ColorPicker({ label = "Couleur", value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() =>
    isValidHex(value) ? hexToHsv(value) : { h: 30, s: 1, v: 0.85 },
  );
  const [hexInput, setHexInput] = useState<string>(value ?? "");
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync hsv quand le parent change la valeur (ex. reset, prefilled).
  useEffect(() => {
    if (isValidHex(value)) {
      setHsv(hexToHsv(value));
      setHexInput(value);
    } else {
      setHexInput("");
    }
  }, [value]);

  // Fermer au clic en dehors / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentHex = useMemo(() => hsvToHex(hsv), [hsv]);
  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

  const commit = (next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexInput(hex);
    onChange(hex);
  };

  const handleSvPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const update = (clientX: number, clientY: number) => {
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      commit({ h: hsv.h, s: x, v: 1 - y });
    };
    update(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => update(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const update = (clientX: number) => {
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      commit({ h: x * 360, s: hsv.s, v: hsv.v });
    };
    update(e.clientX);
    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>

      <div className="relative inline-block">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
        >
          <span
            className="h-6 w-6 rounded border border-zinc-300 dark:border-zinc-700"
            style={{
              backgroundColor: value ?? "transparent",
              backgroundImage: value
                ? undefined
                : "linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%), linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%)",
              backgroundSize: value ? undefined : "8px 8px",
              backgroundPosition: value ? undefined : "0 0, 4px 4px",
            }}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
            {value ?? "Aucune"}
          </span>
          <ChevronDown size={14} className="text-zinc-500" />
        </button>

        {open ? (
          <div
            ref={popoverRef}
            className="absolute z-50 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            {/* 2D Saturation × Value picker */}
            <div
              ref={svRef}
              onPointerDown={handleSvPointer}
              className="relative h-44 w-full cursor-crosshair touch-none rounded-md"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
              }}
            >
              <div
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: currentHex,
                }}
              />
            </div>

            {/* Hue slider */}
            <div
              ref={hueRef}
              onPointerDown={handleHuePointer}
              className="relative mt-3 h-3 w-full cursor-pointer touch-none rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
              />
            </div>

            {/* Hex input + preview */}
            <div className="mt-3 flex items-center gap-2">
              <div
                className="h-8 w-8 flex-shrink-0 rounded border border-zinc-200 dark:border-zinc-700"
                style={{ backgroundColor: currentHex }}
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setHexInput(v);
                  const candidate = v.startsWith("#") ? v : `#${v}`;
                  if (/^#[0-9A-F]{6}$/.test(candidate)) {
                    setHsv(hexToHsv(candidate));
                    onChange(candidate);
                  }
                }}
                placeholder="#D97706"
                maxLength={7}
                className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-xs uppercase tracking-wider focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
              {value ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setHexInput("");
                  }}
                  className="text-xs text-zinc-500 hover:underline"
                >
                  Effacer
                </button>
              ) : null}
            </div>

            {/* Palette d'accès rapide */}
            <div className="mt-3 grid grid-cols-10 gap-1">
              {LOGEMENT_COLORS.map((c) => {
                const selected = value?.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setHsv(hexToHsv(c));
                      setHexInput(c);
                      onChange(c);
                    }}
                    style={{ backgroundColor: c }}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110",
                      selected ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-white" : "",
                    )}
                    aria-label={`Couleur ${c}`}
                  >
                    {selected ? <Check size={10} color="#FFFFFF" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
