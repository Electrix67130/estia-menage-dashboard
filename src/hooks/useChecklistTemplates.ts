"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface TemplateItemInput {
  label: string;
  required?: boolean;
}
export interface TemplateSectionInput {
  label: string;
  items: TemplateItemInput[];
}

export interface ChecklistTemplateListItem {
  id: string;
  organization_id: string;
  name: string;
  section_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplateTree {
  id: string;
  organization_id: string;
  name: string;
  sections: {
    id: string;
    label: string;
    position: number;
    items: { id: string; label: string; position: number; required: boolean }[];
  }[];
}

export function useChecklistTemplates() {
  return useQuery({
    queryKey: ["checklist-templates"],
    queryFn: () => apiFetch<{ data: ChecklistTemplateListItem[] }>("/checklist-templates"),
    staleTime: 30_000,
  });
}

export function useChecklistTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["checklist-template", id],
    queryFn: () => apiFetch<ChecklistTemplateTree>(`/checklist-templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; sections: TemplateSectionInput[] }) =>
      apiFetch<ChecklistTemplateTree>("/checklist-templates", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-templates"] }),
  });
}

export function useUpdateChecklistTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; sections?: TemplateSectionInput[] }) =>
      apiFetch<ChecklistTemplateTree>(`/checklist-templates/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-templates"] });
      qc.invalidateQueries({ queryKey: ["checklist-template", id] });
    },
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/checklist-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-templates"] }),
  });
}

/** Applique un modèle à un logement (copie sections+items). */
export function useApplyChecklistTemplate(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiFetch(`/logements/${logementId}/apply-checklist-template`, {
        method: "POST",
        body: { template_id: templateId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["check-template", logementId] }),
  });
}
