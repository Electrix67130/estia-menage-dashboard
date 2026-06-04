"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `useState` + persistance localStorage côté client.
 *
 * Le state initial démarre toujours sur `defaultValue` (synchrone, server-safe).
 * Au mount, on lit la valeur stockée si disponible et on l'applique.
 *
 * Usage :
 * ```tsx
 * const [filter, setFilter] = usePersistedState("menages.filter.status", "all");
 * ```
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const hydratedRef = useRef(false);

  // Hydratation initiale (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      // Valeur corrompue → on garde le defaultValue.
    } finally {
      hydratedRef.current = true;
    }
  }, [key]);

  // Persistance.
  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silencieux (quota dépassé, mode privé, etc.).
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(defaultValue), [defaultValue]);

  return [value, setValue, reset] as const;
}
