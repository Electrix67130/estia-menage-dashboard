"use client";

import { useState } from "react";

/**
 * Données utilisables pour pré-remplir le formulaire orga, extraites de
 * l'API publique recherche-entreprises.api.gouv.fr (INSEE, sans clé).
 */
export interface SiretLookupResult {
  siret: string;
  name: string;
  legal_form: string | null;
  naf_code: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  vat_number: string | null;
}

interface ApiSiege {
  siret?: string;
  adresse?: string;
  numero_voie?: string;
  type_voie?: string;
  libelle_voie?: string;
  code_postal?: string;
  libelle_commune?: string;
  activite_principale?: string;
}

interface ApiMatchingEtab {
  siret?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  numero_voie?: string;
  type_voie?: string;
  libelle_voie?: string;
  activite_principale?: string;
}

interface ApiResult {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  nature_juridique?: string;
  activite_principale?: string;
  siege?: ApiSiege;
  matching_etablissements?: ApiMatchingEtab[];
}

interface ApiResponse {
  results?: ApiResult[];
}

/**
 * Mappe le code INSEE de catégorie juridique (`nature_juridique`, ex. "5499")
 * vers un libellé lisible (ex. "SARL"). Code inconnu → null (on ne pré-remplit
 * pas plutôt que d'afficher un chiffre).
 */
function legalFormLabel(code?: string | null): string | null {
  if (!code) return null;
  const exact: Record<string, string> = {
    "1000": "Entrepreneur individuel",
    "5202": "SNC",
    "5485": "EURL",
    "5499": "SARL",
    "5710": "SAS",
    "5720": "SASU",
    "6540": "SCI",
    "9220": "Association",
  };
  if (exact[code]) return exact[code];
  if (code.startsWith("10")) return "Entrepreneur individuel";
  if (code.startsWith("54")) return "SARL";
  if (code.startsWith("57")) return "SAS";
  if (code.startsWith("55")) return "SA";
  if (code.startsWith("65")) return "Société civile";
  if (code.startsWith("92")) return "Association";
  return null;
}

/** Calcule le numéro de TVA intracommunautaire FR à partir du SIREN (9 chiffres). */
function computeFrVat(siren: string): string | null {
  if (!/^\d{9}$/.test(siren)) return null;
  // Clé TVA = (12 + 3 × (SIREN mod 97)) mod 97
  const key = (12 + 3 * (parseInt(siren, 10) % 97)) % 97;
  return `FR${key.toString().padStart(2, "0")}${siren}`;
}

function pickEtab(data: ApiResult, siret: string): ApiSiege | ApiMatchingEtab | undefined {
  if (data.siege?.siret === siret) return data.siege;
  return data.matching_etablissements?.find((e) => e.siret === siret) ?? data.siege;
}

function buildStreet(e: ApiSiege | ApiMatchingEtab | undefined): string | null {
  if (!e) return null;
  if (e.adresse) {
    // L'API renvoie souvent "12 RUE DE LA PAIX 75001 PARIS" — on retire le CP+ville.
    const cp = e.code_postal ?? "";
    const city = e.libelle_commune ?? "";
    return e.adresse
      .replace(new RegExp(`\\s*${cp}\\s*${city}\\s*$`, "i"), "")
      .trim();
  }
  return [e.numero_voie, e.type_voie, e.libelle_voie].filter(Boolean).join(" ") || null;
}

export function useSiretLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (rawSiret: string): Promise<SiretLookupResult | null> => {
    const siret = rawSiret.replace(/\s/g, "");
    if (!/^\d{14}$/.test(siret)) {
      setError("SIRET invalide (14 chiffres requis).");
      return null;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`,
      );
      if (!res.ok) throw new Error("Lookup failed");
      const data = (await res.json()) as ApiResponse;
      const first = data.results?.[0];
      if (!first) {
        setError("Entreprise introuvable.");
        return null;
      }
      const etab = pickEtab(first, siret);
      const street = buildStreet(etab);
      const siren = first.siren ?? siret.slice(0, 9);

      return {
        siret,
        name: first.nom_raison_sociale || first.nom_complet || "",
        legal_form: legalFormLabel(first.nature_juridique),
        naf_code: (etab?.activite_principale || first.activite_principale || null)?.toUpperCase().replace(".", "") || null,
        address: street,
        postal_code: etab?.code_postal || null,
        city: etab?.libelle_commune || null,
        vat_number: computeFrVat(siren),
      };
    } catch {
      setError("Erreur réseau lors de la recherche.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookup, isLoading, error };
}
