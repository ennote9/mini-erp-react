import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/shared/i18n";
import type { ProfileOverridesState, WorkspaceModeId } from "@/shared/settings";
import {
  WORKSPACE_MODE_OPTIONS,
  WORKSPACE_MODE_SUMMARY_ORDER,
  getEffectiveProfileOverride,
  modeDefaultForProfileOverride,
  profileOverrideCustomCount,
  profileOverridesAfterToggle,
  profileOverridesHasAnyCustom,
  type ProfileOverrideKey,
  type WorkspaceModeSummarySectionId,
} from "@/shared/workspace";

const OVERRIDE_GROUPS: ReadonlyArray<{
  id: "documents" | "inventory" | "navigation";
  keys: readonly ProfileOverrideKey[];
}> = [
  {
    id: "documents",
    keys: ["documentEventLog", "reverseDocumentActions"],
  },
  {
    id: "inventory",
    keys: ["advancedStockBalanceAnalytics", "stockBalanceSourceModal", "allocationControls"],
  },
  {
    id: "navigation",
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
  const { t } = useTranslation();
  const label = t(`workspaceProfile.overrides.${rowKey}.label`);
  const description = t(`workspaceProfile.overrides.${rowKey}.description`);
  const scope = t(`workspaceProfile.overrides.${rowKey}.scope`);
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
            htmlFor={`profile-override-${rowKey}`}
            className={cn("text-[13px] font-medium leading-tight", isCustom ? "text-foreground" : "text-foreground/90")}
          >
            {label}
          </Label>
          {isCustom ? (
            <span className="rounded border border-sky-400/40 bg-sky-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-100/95">
              {t("workspaceProfile.badgeCustom")}
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground/90">{t("workspaceProfile.badgeDefault")}</span>
          )}
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">{description}</p>
        <p className="text-[9px] text-muted-foreground/80">
          {rowKey === "allocationControls" && requireReservationBeforeShipment ? (
            <>{t("workspaceProfile.allocationForcedHint")}</>
          ) : (
            <>
              {modeLabel}: <span className="font-medium text-foreground/75">{profileDefault ? t("common.yes") : t("common.no")}</span>
              <span className="text-muted-foreground/70"> · {scope}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <Switch
          id={`profile-override-${rowKey}`}
          checked={effective}
          disabled={disabled}
          onCheckedChange={(checked) => {
            onPatchProfileOverrides(
              profileOverridesAfterToggle(workspaceMode, profileOverrides, rowKey, checked, ctx),
            );
          }}
          aria-label={label}
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
  const { t } = useTranslation();
  const modeLabel = t(`workspace.mode.${workspaceMode}.label`);
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
        <CardTitle className="text-sm font-semibold">{t("workspaceProfile.cardTitle")}</CardTitle>
        <CardDescription className="text-[11px] leading-snug">{t("workspaceProfile.cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-3 pt-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded border border-border/55 bg-muted/15 px-2 py-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("workspaceProfile.profileLabel")}</span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              {modeLabel}
            </span>
          </div>
          <span className="hidden h-2.5 w-px bg-border sm:inline-block" aria-hidden />
          <span className="text-muted-foreground">
            {t("workspaceProfile.customLabel")}{" "}
            <span className="tabular-nums font-medium text-foreground/90">{customCount}</span>
            {customCount === 0 ? (
              <span className="text-muted-foreground/75"> · {t("workspaceProfile.defaultsNote")}</span>
            ) : null}
          </span>
        </div>

        <div>
          <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("workspaceProfile.modeHeading")}
          </h3>
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
                <div className="font-medium leading-tight text-foreground">
                  {t(`workspace.mode.${opt.value}.label`)}
                </div>
                <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">
                  {t(`workspace.mode.${opt.value}.hint`)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded border border-border/45 bg-muted/5 px-2 py-1.5">
          <h3 className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("workspaceProfile.whatChangesHeading", { mode: modeLabel })}
          </h3>
          <div className="mt-1 grid gap-x-3 gap-y-1 text-[10px] sm:grid-cols-2">
            {WORKSPACE_MODE_SUMMARY_ORDER.map((sectionId: WorkspaceModeSummarySectionId) => (
              <div key={sectionId} className="flex min-w-0 gap-1.5">
                <span className="w-[5.5rem] shrink-0 font-medium text-foreground/65">
                  {t(`domain.workspace.summarySection.${sectionId}`)}
                </span>
                <span className="min-w-0 leading-snug text-muted-foreground">
                  {t(`domain.workspace.bullets.${workspaceMode}.${sectionId}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("workspaceProfile.overridesHeading")}
            </h3>
            <div
              className="flex w-fit items-center gap-0.5 rounded border border-border/55 bg-muted/10 p-0.5"
              role="group"
              aria-label={t("workspaceProfile.filterAria")}
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
                {t("workspaceProfile.filterAll")}
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
                {t("workspaceProfile.filterCustom")}
              </button>
            </div>
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground">{t("workspaceProfile.toggleHint")}</p>

          <div className="space-y-2">
            {visibleGroups.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">{t("workspaceProfile.noCustomRows")}</p>
            ) : null}
            {visibleGroups.map((group) => (
              <div key={group.id} className="space-y-0.5">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                  {t(`workspaceProfile.groups.${group.id}`)}
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
                  ? t("workspaceProfile.resetOverridesTitle")
                  : t("workspaceProfile.resetOverridesDisabled")
              }
            >
              {t("workspaceProfile.resetOverrides")}
            </Button>
            {!hasCustomOverrides ? (
              <span className="text-[10px] text-muted-foreground/80">{t("workspaceProfile.pureDefaults")}</span>
            ) : (
              <span className="text-[10px] text-muted-foreground/80">
                {t("workspaceProfile.customResetHint", { count: String(customCount) })}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
