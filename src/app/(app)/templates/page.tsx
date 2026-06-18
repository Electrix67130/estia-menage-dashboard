"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { ApiError } from "@/lib/api";
import {
  useChecklistTemplates,
  useChecklistTemplate,
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
  useDeleteChecklistTemplate,
  type TemplateSectionInput,
} from "@/hooks/useChecklistTemplates";

export default function TemplatesPage() {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const isAdmin = user?.role === "admin";
  const list = useChecklistTemplates();
  const remove = useDeleteChecklistTemplate();
  const [editorId, setEditorId] = useState<string | null | undefined>(undefined); // undefined=fermé, null=création

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
          Seul un administrateur peut gérer les modèles de checklist.
        </Card>
      </div>
    );
  }

  const templates = list.data?.data ?? [];

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Supprimer le modèle "${name}" ?`,
      tone: "danger",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Modèle supprimé");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Modèles de checklist</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Crée des modèles réutilisables à appliquer à la création d&apos;un logement.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditorId(null)}>
          <Plus size={14} />
          Nouveau modèle
        </Button>
      </div>

      {list.isLoading ? (
        <Card className="p-6">
          <p className="text-sm text-zinc-500">Chargement…</p>
        </Card>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} />}
          title="Aucun modèle"
          description="Crée un premier modèle de checklist pour gagner du temps à chaque nouveau logement."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-900 dark:text-white">{t.name}</p>
                <p className="text-xs text-zinc-500">
                  {t.section_count} section{t.section_count > 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditorId(t.id)}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id, t.name)}>
                  <Trash2 size={14} className="text-rose-600" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editorId !== undefined ? (
        <TemplateEditorModal templateId={editorId} onClose={() => setEditorId(undefined)} />
      ) : null}
    </div>
  );
}

interface EditableSection {
  label: string;
  items: { label: string; required: boolean }[];
}

function TemplateEditorModal({
  templateId,
  onClose,
}: {
  templateId: string | null;
  onClose: () => void;
}) {
  const isEdit = templateId !== null;
  const detail = useChecklistTemplate(templateId ?? undefined);
  const create = useCreateChecklistTemplate();
  const update = useUpdateChecklistTemplate(templateId ?? "");
  const [name, setName] = useState("");
  const [sections, setSections] = useState<EditableSection[]>([]);

  useEffect(() => {
    if (isEdit && detail.data) {
      setName(detail.data.name);
      setSections(
        detail.data.sections.map((s) => ({
          label: s.label,
          items: s.items.map((it) => ({ label: it.label, required: it.required })),
        })),
      );
    }
  }, [isEdit, detail.data]);

  const addSection = () => setSections((s) => [...s, { label: "", items: [] }]);
  const removeSection = (i: number) => setSections((s) => s.filter((_, idx) => idx !== i));
  const setSectionLabel = (i: number, label: string) =>
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, label } : sec)));
  const addItem = (si: number) =>
    setSections((s) =>
      s.map((sec, idx) => (idx === si ? { ...sec, items: [...sec.items, { label: "", required: true }] } : sec)),
    );
  const removeItem = (si: number, ii: number) =>
    setSections((s) =>
      s.map((sec, idx) => (idx === si ? { ...sec, items: sec.items.filter((_, j) => j !== ii) } : sec)),
    );
  const setItemLabel = (si: number, ii: number, label: string) =>
    setSections((s) =>
      s.map((sec, idx) =>
        idx === si ? { ...sec, items: sec.items.map((it, j) => (j === ii ? { ...it, label } : it)) } : sec,
      ),
    );

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    const cleanSections: TemplateSectionInput[] = sections
      .filter((s) => s.label.trim())
      .map((s) => ({
        label: s.label.trim(),
        items: s.items.filter((it) => it.label.trim()).map((it) => ({ label: it.label.trim(), required: it.required })),
      }));
    try {
      if (isEdit) {
        await update.mutateAsync({ name: name.trim(), sections: cleanSections });
        toast.success("Modèle mis à jour");
      } else {
        await create.mutateAsync({ name: name.trim(), sections: cleanSections });
        toast.success("Modèle créé");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Modifier le modèle" : "Nouveau modèle"}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Nom du modèle" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Studio standard" />

        <div className="flex flex-col gap-3">
          {sections.map((section, si) => (
            <div key={si} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  value={section.label}
                  onChange={(e) => setSectionLabel(si, e.target.value)}
                  placeholder="Nom de la section (ex. Cuisine)"
                />
                <button
                  type="button"
                  onClick={() => removeSection(si)}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-rose-600 dark:hover:bg-zinc-800"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-1.5 pl-3">
                {section.items.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    <span className="text-zinc-300">•</span>
                    <Input
                      className="flex-1"
                      value={item.label}
                      onChange={(e) => setItemLabel(si, ii, e.target.value)}
                      placeholder="Tâche (ex. Nettoyer le plan de travail)"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(si, ii)}
                      className="rounded p-1 text-zinc-400 hover:text-rose-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addItem(si)}
                  className="mt-1 self-start text-xs font-semibold text-blue-600 hover:underline"
                >
                  + Ajouter une tâche
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addSection}
            className="self-start rounded-md border border-dashed border-blue-400 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            + Ajouter une section
          </button>
        </div>
      </div>
    </Modal>
  );
}
