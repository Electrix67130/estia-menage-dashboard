"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, API_URL, getAccessToken } from "@/lib/api";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "change-me-in-production";

export type InvoiceType = "invoice" | "quote";
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "cancelled"
  | "accepted"
  | "refused";

export interface Invoice {
  id: string;
  organization_id: string;
  client_id: string;
  type: InvoiceType;
  number: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  currency: string;
  total_ht: string;
  total_tva: string;
  total_ttc: string;
  notes: string | null;
  created_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  menage_id: string | null;
  label: string;
  quantity: string;
  unit_price_ht: string;
  vat_rate: string;
  line_ht: string;
  line_tva: string;
  line_ttc: string;
  position: number;
}

export interface ProviderRecap {
  user_id: string;
  first_name: string;
  last_name: string;
  n_menages: number;
  total: string | number;
}

export interface CreateInvoiceInput {
  client_id: string;
  type: InvoiceType;
  period_start?: string;
  period_end?: string;
  menage_ids?: string[];
  due_date?: string;
  notes?: string;
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  due_date?: string;
  notes?: string;
}

const INVOICES_KEY = ["invoices"] as const;

export function useInvoices(params: {
  type?: InvoiceType;
  status?: InvoiceStatus;
  client_id?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.status) qs.set("status", params.status);
  if (params.client_id) qs.set("client_id", params.client_id);
  const query = qs.toString();
  return useQuery({
    queryKey: [...INVOICES_KEY, params.type ?? "", params.status ?? "", params.client_id ?? ""],
    queryFn: () =>
      apiFetch<{ data: Invoice[] }>(`/invoices${query ? `?${query}` : ""}`),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: [...INVOICES_KEY, "detail", id],
    queryFn: () => apiFetch<{ invoice: Invoice; lines: InvoiceLine[] }>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      apiFetch<Invoice>("/invoices", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInvoiceInput }) =>
      apiFetch<Invoice>(`/invoices/${id}`, { method: "PATCH", body: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
      qc.invalidateQueries({ queryKey: [...INVOICES_KEY, "detail", vars.id] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useProviderRecap() {
  return useQuery({
    queryKey: [...INVOICES_KEY, "provider-recap"],
    queryFn: () => apiFetch<{ data: ProviderRecap[] }>("/invoices/provider-recap"),
  });
}

/**
 * Récupère un binaire authentifié (PDF / CSV) depuis l'API et déclenche
 * le téléchargement côté navigateur. apiFetch ne gère que le JSON, on fait
 * donc un fetch manuel avec les mêmes headers (Bearer + x-api-key).
 */
export async function downloadInvoiceFile(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = { "x-api-key": API_KEY };
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    let message = response.statusText || "Téléchargement impossible";
    try {
      const data = (await response.clone().json()) as { message?: unknown };
      if (typeof data.message === "string" && data.message.length > 0) message = data.message;
    } catch {
      /* corps non-JSON, on garde le statusText */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
