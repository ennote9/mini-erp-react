import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/shared/i18n/context";
import { useAppReadModelRevision } from "@/shared/inventoryMasterPageBlocks/useAppReadModelRevision";
import { brandRepository } from "@/modules/brands/repository";
import { categoryRepository } from "@/modules/categories/repository";
import { warehouseRepository } from "@/modules/warehouses/repository";

type EntityOption = { id: string; caption: string };

function toggleId(ids: string[], id: string, on: boolean): string[] {
  const set = new Set(ids);
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}

function ScopeBlock({
  blockId,
  title,
  hint,
  options,
  selected,
  disabled,
  onToggle,
  unknownSelected,
}: {
  blockId: string;
  title: string;
  hint: string;
  options: EntityOption[];
  selected: string[];
  disabled?: boolean;
  onToggle: (id: string, on: boolean) => void;
  unknownSelected: string[];
}) {
  const { t } = useTranslation();
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  return (
    <div className="space-y-2 rounded-md border border-border/60 p-2">
      <div>
        <div className="text-xs font-medium text-foreground">{title}</div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      </div>
      {unknownSelected.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px] text-muted-foreground">
          <div className="font-medium text-amber-900 dark:text-amber-200">{t("employees.access.scopeNotInMasterTitle")}</div>
          <div className="mt-1.5 space-y-1.5">
            {unknownSelected.map((id) => (
              <div key={id} className="flex items-start gap-2">
                <Checkbox
                  id={`scope-${blockId}-orphan-${id}`}
                  disabled={disabled}
                  checked
                  onCheckedChange={(v) => onToggle(id, v === true)}
                />
                <Label htmlFor={`scope-${blockId}-orphan-${id}`} className="cursor-pointer font-mono text-[11px] text-foreground/90">
                  {id}
                  <span className="ml-1 font-sans text-muted-foreground">({t("employees.access.scopeNotInMasterTag")})</span>
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid max-h-44 gap-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => (
          <div key={o.id} className="flex items-start gap-2">
            <Checkbox
              id={`scope-${blockId}-${o.id}`}
              disabled={disabled}
              checked={selectedSet.has(o.id)}
              onCheckedChange={(v) => onToggle(o.id, v === true)}
            />
            <Label htmlFor={`scope-${blockId}-${o.id}`} className="cursor-pointer text-[11px] leading-tight text-foreground/90">
              {o.caption}
            </Label>
          </div>
        ))}
      </div>
      {options.length === 0 && (
        <div className="text-[11px] text-muted-foreground">{t("employees.access.scopeDirectoryEmpty")}</div>
      )}
    </div>
  );
}

function buildUnknownSelected(selected: string[], options: EntityOption[]): string[] {
  const known = new Set(options.map((o) => o.id));
  return selected.filter((id) => !known.has(id));
}

type PatchAccess = (fn: (prev: string[]) => string[]) => void;

export function EmployeeAccessDataScopes(props: {
  warehouseScopeIds: string[];
  categoryScopeIds: string[];
  brandScopeIds: string[];
  disabled?: boolean;
  onPatchScopes: (next: {
    warehouseScopeIds: string[];
    categoryScopeIds: string[];
    brandScopeIds: string[];
  }) => void;
}) {
  const { t } = useTranslation();
  const rev = useAppReadModelRevision();

  const warehouses = useMemo((): EntityOption[] => {
    void rev;
    return warehouseRepository
      .list()
      .map((w) => ({ id: w.id, caption: `${w.code} · ${w.name}` }))
      .sort((a, b) => a.caption.localeCompare(b.caption));
  }, [rev]);

  const categories = useMemo((): EntityOption[] => {
    void rev;
    return categoryRepository
      .list()
      .map((c) => ({ id: c.id, caption: `${c.code} · ${c.name}` }))
      .sort((a, b) => a.caption.localeCompare(b.caption));
  }, [rev]);

  const brands = useMemo((): EntityOption[] => {
    void rev;
    return brandRepository
      .list()
      .map((b) => ({ id: b.id, caption: `${b.code} · ${b.name}` }))
      .sort((a, b) => a.caption.localeCompare(b.caption));
  }, [rev]);

  const patchWarehouses: PatchAccess = (fn) =>
    props.onPatchScopes({
      warehouseScopeIds: fn(props.warehouseScopeIds),
      categoryScopeIds: props.categoryScopeIds,
      brandScopeIds: props.brandScopeIds,
    });
  const patchCategories: PatchAccess = (fn) =>
    props.onPatchScopes({
      warehouseScopeIds: props.warehouseScopeIds,
      categoryScopeIds: fn(props.categoryScopeIds),
      brandScopeIds: props.brandScopeIds,
    });
  const patchBrands: PatchAccess = (fn) =>
    props.onPatchScopes({
      warehouseScopeIds: props.warehouseScopeIds,
      categoryScopeIds: props.categoryScopeIds,
      brandScopeIds: fn(props.brandScopeIds),
    });

  return (
    <div className="space-y-3">
      <ScopeBlock
        blockId="wh"
        title={t("employees.tabs.access.scopesWarehousesTitle")}
        hint={t("employees.tabs.access.scopesWarehousesHint")}
        options={warehouses}
        selected={props.warehouseScopeIds}
        disabled={props.disabled}
        onToggle={(id, on) => patchWarehouses((cur) => toggleId(cur, id, on))}
        unknownSelected={buildUnknownSelected(props.warehouseScopeIds, warehouses)}
      />
      <ScopeBlock
        blockId="cat"
        title={t("employees.tabs.access.scopesCategoriesTitle")}
        hint={t("employees.tabs.access.scopesCategoriesHint")}
        options={categories}
        selected={props.categoryScopeIds}
        disabled={props.disabled}
        onToggle={(id, on) => patchCategories((cur) => toggleId(cur, id, on))}
        unknownSelected={buildUnknownSelected(props.categoryScopeIds, categories)}
      />
      <ScopeBlock
        blockId="br"
        title={t("employees.tabs.access.scopesBrandsTitle")}
        hint={t("employees.tabs.access.scopesBrandsHint")}
        options={brands}
        selected={props.brandScopeIds}
        disabled={props.disabled}
        onToggle={(id, on) => patchBrands((cur) => toggleId(cur, id, on))}
        unknownSelected={buildUnknownSelected(props.brandScopeIds, brands)}
      />
    </div>
  );
}
