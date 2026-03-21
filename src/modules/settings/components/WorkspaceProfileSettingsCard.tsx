import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ProfileOverridesState, WorkspaceModeId } from "@/shared/settings";
import {
  WORKSPACE_MODE_OPTIONS,
  WORKSPACE_MODE_CHANGE_BULLETS,
  WORKSPACE_MODE_SUMMARY_ORDER,
  WORKSPACE_MODE_SUMMARY_SECTION_LABELS,
  getEffectiveProfileOverride,
  modeDefaultForProfileOverride,
  profileOverrideCustomCount,
  profileOverridesAfterToggle,
  profileOverridesHasAnyCustom,
  type ProfileOverrideKey,
} from "@/shared/workspace";

const OVERRIDE_ROW_BY_KEY = new Map(
  (
    [
      {
        key: "documentEventLog",
        label: "Show event log on document pages",
        description: "Audit timeline on PO, SO, receipt, shipment (with Documents › event log when shown).",
        scope: "Document pages",
      },
      {
        key: "reverseDocumentActions",
        label: "Show reverse document actions",
        description: "Reverse on posted receipt & shipment headers.",
        scope: "Receipt & shipment",
      },
      {
        key: "stockMovementsNav",
        label: "Show stock movements navigation",
        description: "Sidebar, dashboard card, and quick link.",
        scope: "Sidebar & dashboard",
      },
      {
        key: "advancedStockBalanceAnalytics",
        label: "Show advanced stock balance analytics",
        description: "Reserved, coverage, shortage columns and quick filters.",
        scope: "Stock balances",
      },
      {
        key: "stockBalanceSourceModal",
        label: "Show stock balance source drill-down",
        description: "Row click opens source breakdown.",
        scope: "Stock balances",
      },
      {
        key: "allocationControls",
        label: "Show allocation controls on sales orders",
        description: "Allocate stock, summary, reserved/shortage columns.",
        scope: "Sales order",
      },
    ] as const
  ).map((r) => [r.key, r]),
);

const OVERRIDE_GROUPS: ReadonlyArray<{
  id: string;
  label: string;
  keys: readonly ProfileOverrideKey[];
}> = [
  {
    id: "documents",
    label: "Documents",
    keys: ["documentEventLog", "reverseDocumentActions"],
  },
  {
    id: "inventory",
    label: "Inventory",
    keys: ["advancedStockBalanceAnalytics", "stockBalanceSourceModal", "allocationControls"],
  },
  {
    id: "navigation",
    label: "Navigation & diagnostics",
    keys: ["stockMovementsNav"],
  },
];

type OverrideViewFilter = "all" | "custom";

type Props = {
  workspaceMode: WorkspaceModeId;
  profileOverrides: ProfileOverridesState;
  requireReservationBeforeShipment: boolean;
  onSelectMode: (mode: WorkspaceModeId) => void;
  onPatchProfileOverrides: (next: ProfileOverridesState) => void;
  onResetProfileOverrides: () => void;
};

function OverrideRow({
  rowKey,
  workspaceMode,
  profileOverrides,
  requireReservationBeforeShipment,
  modeLabel,
  onPatchProfileOverrides,
}: {
  rowKey: ProfileOverrideKey;
  workspaceMode: WorkspaceModeId;
  profileOverrides: ProfileOverridesState;
  requireReservationBeforeShipment: boolean;
  modeLabel: string;
  onPatchProfileOverrides: (next: ProfileOverridesState) => void;
}) {
  const row = OVERRIDE_ROW_BY_KEY.get(rowKey)!;
  const ctx =
    rowKey === "allocationControls" ? { requireReservationBeforeShipment } : undefined;
  const effective = getEffectiveProfileOverride(workspaceMode, profileOverrides, rowKey, ctx);
  const isCustom = profileOverrides[rowKey] !== null;
  const profileDefault = modeDefaultForProfileOverride(workspaceMode, rowKey, ctx);
  const disabled = rowKey === "allocationControls" && requireReservationBeforeShipment;

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-md border border-transparent py-1.5 pl-1.5 pr-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3",
        isCustom
          ? "border-sky-500/30 bg-sky-500/[0.08] ring-1 ring-inset ring-sky-500/15"
          : "bg-transparent",
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5 pr-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <Label
            htmlFor={`profile-override-${row.key}`}
            className={cn("text-[13px] font-medium leading-tight", isCustom ? "text-foreground" : "text-foreground/90")}
          >
            {row.label}
          </Label>
          {isCustom ? (
            <span className="rounded border border-sky-400/40 bg-sky-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-100/95">
              Custom
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground/90">Default</span>
          )}
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">{row.description}</p>
        <p className="text-[9px] text-muted-foreground/80">
          {rowKey === "allocationControls" && requireReservationBeforeShipment ? (
            <>On while Inventory requires reservation before shipment.</>
          ) : (
            <>
              {modeLabel}: <span className="font-medium text-foreground/75">{profileDefault ? "On" : "Off"}</span>
              <span className="text-muted-foreground/70"> · {row.scope}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <Switch
          id={`profile-override-${row.key}`}
          checked={effective}
          disabled={disabled}
          onCheckedChange={(checked) => {
            onPatchProfileOverrides(
              profileOverridesAfterToggle(workspaceMode, profileOverrides, rowKey, checked, ctx),
            );
          }}
          aria-label={row.label}
        />
      </div>
    </div>
  );
}

export function WorkspaceProfileSettingsCard({
  workspaceMode,
  profileOverrides,
  requireReservationBeforeShipment,
  onSelectMode,
  onPatchProfileOverrides,
  onResetProfileOverrides,
}: Props) {
  const modeLabel = WORKSPACE_MODE_OPTIONS.find((o) => o.value === workspaceMode)?.label ?? workspaceMode;
  const bullets = WORKSPACE_MODE_CHANGE_BULLETS[workspaceMode];
  const hasCustomOverrides = profileOverridesHasAnyCustom(profileOverrides);
  const customCount = profileOverrideCustomCount(profileOverrides);
  const [overrideView, setOverrideView] = useState<OverrideViewFilter>("all");

  const visibleGroups = useMemo(() => {
    if (overrideView === "all") return OVERRIDE_GROUPS;
    return OVERRIDE_GROUPS.map((g) => ({
      ...g,
      keys: g.keys.filter((k) => profileOverrides[k] !== null),
    })).filter((g) => g.keys.length > 0);
  }, [overrideView, profileOverrides]);

  return (
    <Card className="shrink-0 border-border/70 bg-card/40 shadow-none">
      <CardHeader className="space-y-0.5 pb-2 pt-1">
        <CardTitle className="text-sm font-semibold">Workspace profile</CardTitle>
        <CardDescription className="text-[11px] leading-snug">
          Baseline mode plus optional visibility overrides (saved with settings).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-3 pt-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded border border-border/55 bg-muted/15 px-2 py-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Profile</span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              {modeLabel}
            </span>
          </div>
          <span className="hidden h-2.5 w-px bg-border sm:inline-block" aria-hidden />
          <span className="text-muted-foreground">
            Custom: <span className="tabular-nums font-medium text-foreground/90">{customCount}</span>
            {customCount === 0 ? <span className="text-muted-foreground/75"> · defaults</span> : null}
          </span>
        </div>

        <div>
          <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Mode</h3>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {WORKSPACE_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelectMode(opt.value)}
                className={cn(
                  "rounded-md border p-2 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  workspaceMode === opt.value
                    ? "border-primary bg-primary/10"
                    : "border-border/60 bg-muted/10 hover:bg-muted/30",
                )}
              >
                <div className="font-medium leading-tight text-foreground">{opt.label}</div>
                <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{opt.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded border border-border/45 bg-muted/5 px-2 py-1.5">
          <h3 className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            What &ldquo;{modeLabel}&rdquo; changes
          </h3>
          <div className="mt-1 grid gap-x-3 gap-y-1 text-[10px] sm:grid-cols-2">
            {WORKSPACE_MODE_SUMMARY_ORDER.map((sectionId) => (
              <div key={sectionId} className="flex min-w-0 gap-1.5">
                <span className="w-[5.5rem] shrink-0 font-medium text-foreground/65">
                  {WORKSPACE_MODE_SUMMARY_SECTION_LABELS[sectionId]}
                </span>
                <span className="min-w-0 leading-snug text-muted-foreground">
                  {bullets[sectionId].join(" ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Overrides</h3>
            <div
              className="flex w-fit items-center gap-0.5 rounded border border-border/55 bg-muted/10 p-0.5"
              role="group"
              aria-label="Override list filter"
            >
              <button
                type="button"
                onClick={() => setOverrideView("all")}
                className={cn(
                  "h-6 rounded px-2 text-[10px] font-medium transition-colors",
                  overrideView === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setOverrideView("custom")}
                className={cn(
                  "h-6 rounded px-2 text-[10px] font-medium transition-colors",
                  overrideView === "custom"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Custom
              </button>
            </div>
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Toggle on/off. Matching the profile clears the stored override.
          </p>

          <div className="space-y-2">
            {visibleGroups.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">
                No custom rows — use &ldquo;All&rdquo; or set an override.
              </p>
            ) : null}
            {visibleGroups.map((group) => (
              <div key={group.id} className="space-y-0.5">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                  {group.label}
                </div>
                <div className="divide-y divide-border/35 rounded border border-border/50 bg-card/25 px-1 py-0">
                  {group.keys.map((rowKey) => (
                    <OverrideRow
                      key={rowKey}
                      rowKey={rowKey}
                      workspaceMode={workspaceMode}
                      profileOverrides={profileOverrides}
                      requireReservationBeforeShipment={requireReservationBeforeShipment}
                      modeLabel={modeLabel}
                      onPatchProfileOverrides={onPatchProfileOverrides}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border/45 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-fit text-[11px] text-muted-foreground"
              disabled={!hasCustomOverrides}
              onClick={onResetProfileOverrides}
              title={
                hasCustomOverrides
                  ? "Clear custom overrides for this profile."
                  : "No custom overrides to reset."
              }
            >
              Reset overrides to profile defaults
            </Button>
            {!hasCustomOverrides ? (
              <span className="text-[10px] text-muted-foreground/80">Pure profile defaults.</span>
            ) : (
              <span className="text-[10px] text-muted-foreground/80">
                {customCount} custom — reset clears them.
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
