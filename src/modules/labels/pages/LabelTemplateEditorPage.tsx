import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/shared/i18n";
import { itemRepository } from "@/modules/items/repository";
import { labelTemplateRepository } from "../labelTemplateRepository";
import { persistLabelTemplate } from "../service";
import type { LabelElement, LabelTemplate, LabelTemplateKind, LabelPaperType } from "../model";
import { LABEL_PREVIEW_DEMO_CONTEXT } from "../lib/previewContext";
import { buildItemPreviewBindingContext } from "../lib/itemPreviewContext";
import { collectLabelDomainIssues } from "../lib/labelDomainValidation";
import { LABELS_WORKSPACE_QUERY } from "../lib/workspaceQueryParams";
import { cloneLabelTemplate } from "../lib/cloneLabelTemplate";
import { createDefaultLabelElement, type NewLabelElementType } from "../lib/createDefaultLabelElement";
import {
  validateLabelTemplateDraft,
  type LabelTemplateValidationCode,
} from "../lib/validateLabelTemplateDraft";
import { LabelTemplatePreview } from "../components/preview/LabelTemplatePreview";
import { LabelsSubnav } from "../components/LabelsSubnav";
import { LabelDomainIssuesBanner } from "../components/LabelDomainIssuesBanner";
import { LabelTemplateElementsList } from "../components/editor/LabelTemplateElementsList";
import { LabelElementPropertiesPanel } from "../components/editor/LabelElementPropertiesPanel";

const KINDS: LabelTemplateKind[] = [
  "ITEM_LABEL",
  "PRICE_TAG",
  "QR_LABEL",
  "TRANSLATION_STICKER",
  "KIZ_LABEL",
  "DATAMATRIX_LABEL",
  "CUSTOM",
];

const PAPERS: LabelPaperType[] = ["LABEL", "A4", "ROLL", "CUSTOM"];

function numOr(v: string, fallback: number): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export function LabelTemplateEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const itemIdQuery = searchParams.get("itemId") ?? "";
  const barcodeIdQuery = searchParams.get("barcodeId") ?? "";

  const [draft, setDraft] = useState<LabelTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addType, setAddType] = useState<NewLabelElementType>("text");
  const [validationCodes, setValidationCodes] = useState<LabelTemplateValidationCode[]>([]);

  const item = useMemo(
    () => (itemIdQuery ? itemRepository.getById(itemIdQuery) : undefined),
    [itemIdQuery],
  );

  const previewContext = useMemo(() => {
    if (!itemIdQuery || !item) return LABEL_PREVIEW_DEMO_CONTEXT;
    return buildItemPreviewBindingContext(item, { barcodeId: barcodeIdQuery || undefined }).context;
  }, [itemIdQuery, item, barcodeIdQuery]);

  const showDemoHint = !itemIdQuery || !item;

  const editorDomainIssues = useMemo(() => {
    if (!draft || !itemIdQuery || !item) return [];
    return collectLabelDomainIssues(draft, previewContext, t);
  }, [draft, itemIdQuery, item, previewContext, t]);

  const load = useCallback(() => {
    if (!id) {
      setDraft(null);
      setSelectedId(null);
      return;
    }
    const src = labelTemplateRepository.getById(id);
    if (!src) {
      setDraft(null);
      setSelectedId(null);
      return;
    }
    const next = cloneLabelTemplate(src);
    setDraft(next);
    setSelectedId(next.elements[0]?.id ?? null);
    setValidationCodes([]);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedElement = useMemo(
    () => draft?.elements.find((e) => e.id === selectedId) ?? null,
    [draft, selectedId],
  );

  const archivedReadOnly = draft?.isArchived === true;

  const onElementChange = useCallback(
    (next: LabelElement) => {
      setDraft((d) => {
        if (!d) return d;
        return { ...d, elements: d.elements.map((e) => (e.id === next.id ? next : e)) };
      });
    },
    [],
  );

  const onRemoveElement = useCallback((removeId: string) => {
    setDraft((d) => {
      if (!d) return d;
      const idx = d.elements.findIndex((e) => e.id === removeId);
      const elements = d.elements.filter((e) => e.id !== removeId);
      setSelectedId((sel) => {
        if (sel !== removeId) return sel;
        return elements[idx]?.id ?? elements[idx - 1]?.id ?? null;
      });
      return { ...d, elements };
    });
  }, []);

  const onAddElement = useCallback(() => {
    setDraft((d) => {
      if (!d) return d;
      const el = createDefaultLabelElement(addType, d.sizeMm);
      setSelectedId(el.id);
      return { ...d, elements: [...d.elements, el] };
    });
  }, [addType]);

  const onSave = useCallback(() => {
    if (!draft || archivedReadOnly) return;
    const codes = validateLabelTemplateDraft(draft);
    setValidationCodes(codes);
    if (codes.length > 0) return;
    const saved = persistLabelTemplate(draft);
    setDraft(cloneLabelTemplate(saved));
  }, [draft, archivedReadOnly]);

  if (!id) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">{t("labels.editor.notFound")}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => navigate("/labels")}>
          {t("labels.editor.backToList")}
        </Button>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">{t("labels.editor.notFound")}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => navigate("/labels")}>
          {t("labels.editor.backToList")}
        </Button>
      </div>
    );
  }

  const workspaceHref = (() => {
    const q = new URLSearchParams();
    q.set(LABELS_WORKSPACE_QUERY.templateId, draft.id);
    if (itemIdQuery) q.set(LABELS_WORKSPACE_QUERY.itemId, itemIdQuery);
    if (barcodeIdQuery) q.set(LABELS_WORKSPACE_QUERY.barcodeId, barcodeIdQuery);
    return `/labels/workspace?${q.toString()}`;
  })();

  return (
    <div className="label-template-editor mx-auto flex max-w-[1800px] flex-col gap-3 p-4 md:p-5" data-module="labels">
      <LabelsSubnav />

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{t("labels.editor.title")}</h2>
          <p className="text-xs text-muted-foreground">{draft.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/labels")}>
            {t("common.back")}
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={workspaceHref}>{t("labels.editor.openWorkspace")}</Link>
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={archivedReadOnly}>
            {t("common.save")}
          </Button>
        </div>
      </header>

      {archivedReadOnly ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          {t("labels.editor.archivedReadOnly")}
        </div>
      ) : null}

      {validationCodes.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
          {validationCodes.map((c) => (
            <div key={c}>{t(`labels.editor.validation.${c}`)}</div>
          ))}
        </div>
      ) : null}

      <section className="rounded-md border border-border/70 bg-muted/10 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("labels.editor.meta.sectionTitle")}
        </p>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("labels.list.columnName")}</Label>
              <Input
                className="h-8"
                disabled={archivedReadOnly}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("common.description")}</Label>
              <Textarea
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                disabled={archivedReadOnly}
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("labels.list.columnKind")}</Label>
              <SelectField
                value={draft.kind}
                onChange={(v) => setDraft({ ...draft, kind: v as LabelTemplateKind })}
                options={KINDS.map((k) => ({
                  value: k,
                  label: t(`labels.kind.${k}`),
                }))}
                placeholder=""
                disabled={archivedReadOnly}
                className="w-full max-w-full"
                aria-label={t("labels.list.columnKind")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("labels.editor.meta.paperType")}</Label>
              <SelectField
                value={draft.paperType}
                onChange={(v) => setDraft({ ...draft, paperType: v as LabelPaperType })}
                options={PAPERS.map((p) => ({
                  value: p,
                  label: t(`labels.paper.${p}`),
                }))}
                placeholder=""
                disabled={archivedReadOnly}
                className="w-full max-w-full"
                aria-label={t("labels.editor.meta.paperType")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("labels.editor.meta.widthMm")}</Label>
              <Input
                type="number"
                step="0.1"
                min={0.1}
                className="h-8"
                disabled={archivedReadOnly}
                value={draft.sizeMm.width}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sizeMm: { ...draft.sizeMm, width: numOr(e.target.value, draft.sizeMm.width) },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("labels.editor.meta.heightMm")}</Label>
              <Input
                type="number"
                step="0.1"
                min={0.1}
                className="h-8"
                disabled={archivedReadOnly}
                value={draft.sizeMm.height}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sizeMm: { ...draft.sizeMm, height: numOr(e.target.value, draft.sizeMm.height) },
                  })
                }
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-h-[min(70vh,900px)] grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(260px,340px)]">
        <aside className="flex min-h-0 flex-col rounded-md border border-border/70 bg-card/30 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.editor.elements.title")}
          </p>
          <LabelTemplateElementsList
            elements={draft.elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={onRemoveElement}
            addType={addType}
            onAddTypeChange={setAddType}
            onAdd={onAddElement}
            disabled={archivedReadOnly}
          />
        </aside>

        <section className="flex min-h-0 flex-col gap-2 overflow-auto rounded-md border border-border/70 bg-card/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.editor.preview.title")}
          </p>
          <LabelDomainIssuesBanner
            show={!showDemoHint && editorDomainIssues.length > 0}
            issues={editorDomainIssues}
            testId="labels-editor-domain-issues"
          />
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto rounded-md bg-muted/20 p-3">
            <LabelTemplatePreview
              template={draft}
              context={previewContext}
              showDemoHint={showDemoHint}
              selectedElementId={selectedId}
            />
          </div>
        </section>

        <aside className="min-h-0 overflow-auto rounded-md border border-border/70 bg-card/30 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("labels.editor.properties.title")}
          </p>
          <LabelElementPropertiesPanel
            element={selectedElement}
            onChange={onElementChange}
            disabled={archivedReadOnly}
          />
        </aside>
      </div>
    </div>
  );
}
