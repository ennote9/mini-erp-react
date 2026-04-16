import { useMatch, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs } from "radix-ui";
import { Save, X } from "lucide-react";
import { employeeRepository, flushPendingEmployeePersist } from "../repository";
import { createBlankEmployee, normalizeEmployeeForSave, buildAuditEventsForSave } from "../service";
import type { Employee } from "../model";
import { DocumentPageLayout } from "@/shared/ui/object/DocumentPageLayout";
import { BackButton } from "@/shared/ui/list/BackButton";
import { Button } from "@/components/ui/button";
import { DocumentIssueStrip } from "@/shared/ui/feedback/DocumentIssueStrip";
import {
  actionWarning,
  combineIssues,
  hasErrors,
  type Issue,
} from "@/shared/issues";
import { getEmployeeDocumentHealth } from "../employeeHealth";
import { useTranslation } from "@/shared/i18n/context";
import { appendReturnTo, readReturnToParam } from "@/shared/navigation/returnTo";
import { useUrlTabState } from "@/shared/navigation/useUrlTabState";
import { EMPLOYEE_TAB_IDS, type EmployeeTabId } from "../employeeTabIds";
import { EmployeeMainTab } from "../components/tabs/EmployeeMainTab";
import { EmployeeOrgTab } from "../components/tabs/EmployeeOrgTab";
import { EmployeeContactsTab } from "../components/tabs/EmployeeContactsTab";
import { EmployeeAccessTab } from "../components/tabs/EmployeeAccessTab";
import { EmployeeBusinessRolesTab } from "../components/tabs/EmployeeBusinessRolesTab";
import { EmployeeLinkedTab } from "../components/tabs/EmployeeLinkedTab";
import { EmployeeFilesTab } from "../components/tabs/EmployeeFilesTab";
import { EmployeeAvailabilityTab } from "../components/tabs/EmployeeAvailabilityTab";
import { EmployeeHistoryTab } from "../components/tabs/EmployeeHistoryTab";
import { cn } from "@/lib/utils";

function cloneEmployee(e: Employee): Employee {
  return JSON.parse(JSON.stringify(e)) as Employee;
}

function HeaderStatusGroup({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "danger" | "warn";
}) {
  return (
    <div
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border px-2 py-1 text-xs",
        tone === "neutral" && "border-border bg-muted/30",
        tone === "danger" && "border-destructive/40 bg-destructive/10",
        tone === "warn" && "border-amber-500/35 bg-amber-500/5",
      )}
    >
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

export function EmployeePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = useMemo(() => readReturnToParam(searchParams), [searchParams]);
  const routeNew = useMatch({ path: "/employees/new", end: true });
  const { id: idParam } = useParams<{ id: string }>();
  const isNew = routeNew != null;
  const id = isNew ? undefined : idParam;

  const stored = useMemo(() => (id ? employeeRepository.getById(id) : undefined), [id, isNew]);

  const [draft, setDraft] = useState<Employee | null>(null);
  const [baseline, setBaseline] = useState<Employee | null>(null);
  const [actionIssues, setActionIssues] = useState<Issue[]>([]);

  const [activeTab, setActiveTab] = useUrlTabState<EmployeeTabId>({
    defaultValue: "main",
    allowedValues: EMPLOYEE_TAB_IDS,
  });

  useEffect(() => {
    setActionIssues([]);
  }, [id, isNew]);

  useEffect(() => {
    if (isNew) {
      const blank = createBlankEmployee();
      setDraft(blank);
      setBaseline(null);
      return;
    }
    if (stored) {
      const c = cloneEmployee(stored);
      setDraft(c);
      setBaseline(cloneEmployee(stored));
      return;
    }
    setDraft(null);
    setBaseline(null);
  }, [isNew, stored?.id]);

  const patch = useCallback((fn: (prev: Employee) => Employee) => {
    setDraft((d) => (d ? fn(d) : d));
  }, []);

  const health = useMemo(() => (draft ? getEmployeeDocumentHealth(draft) : { issues: [] as Issue[] }), [draft]);

  const combinedIssues = useMemo(
    () => combineIssues(health.issues, actionIssues),
    [health.issues, actionIssues],
  );

  const handleCancel = useCallback(() => {
    navigate(appendReturnTo("/employees", returnTo));
  }, [navigate, returnTo]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    const normalized = normalizeEmployeeForSave(draft);
    const h = getEmployeeDocumentHealth(normalized);
    if (hasErrors(h.issues)) {
      setActionIssues([]);
      return;
    }
    try {
      const actor = t("employees.audit.actorCurrentUser");
      const prev = baseline;
      const extra = buildAuditEventsForSave(prev, normalized, actor);
      const toStore: Employee = {
        ...normalized,
        audit: [...normalized.audit, ...extra],
      };

      if (isNew) {
        const { id: _old, ...rest } = toStore;
        const created = employeeRepository.create(rest);
        await flushPendingEmployeePersist();
        navigate(appendReturnTo(`/employees/${created.id}`, returnTo), { replace: true });
        return;
      }
      if (!id) return;
      employeeRepository.replace(id, { ...toStore, id });
      await flushPendingEmployeePersist();
      const saved = employeeRepository.getById(id);
      if (saved) {
        setDraft(cloneEmployee(saved));
        setBaseline(cloneEmployee(saved));
      }
      setActionIssues([actionWarning(t("employees.messages.saved"))]);
    } catch (e) {
      setActionIssues([
        {
          severity: "error",
          scope: "action",
          message: e instanceof Error ? e.message : String(e),
        },
      ]);
    }
  }, [draft, baseline, isNew, id, navigate, returnTo, t]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  if (!isNew && id && !stored) {
    return <div className="p-6 text-sm text-muted-foreground">{t("master.common.notFound")}</div>;
  }

  if (!draft) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const title = isNew
    ? t("employees.page.titleNew")
    : t("employees.page.titleEdit", { code: draft.identity.employeeCode });

  const accessTone =
    draft.access.accessStatus === "blocked"
      ? "danger"
      : draft.access.accessStatus === "pending"
        ? "warn"
        : "neutral";
  const availabilityTone = draft.availability.kind === "dismissed" ? "danger" : "neutral";

  const summaryChips = (
    <div className="flex flex-wrap items-center gap-2">
      <HeaderStatusGroup
        label={t("employees.header.record")}
        value={t(`employees.enums.recordStatus.${draft.identity.status}`)}
        tone="neutral"
      />
      <HeaderStatusGroup
        label={t("employees.header.access")}
        value={t(`employees.enums.accessStatus.${draft.access.accessStatus}`)}
        tone={accessTone}
      />
      <HeaderStatusGroup
        label={t("employees.header.availability")}
        value={t(`employees.enums.availability.${draft.availability.kind}`)}
        tone={availabilityTone}
      />
    </div>
  );

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-lg font-semibold leading-tight">{title}</h2>
          {summaryChips}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={handleCancel}>
            <X className="h-4 w-4" />
            {t("common.cancel")}
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1" onClick={() => void handleSave()}>
            <Save className="h-4 w-4" />
            {t("common.save")}
          </Button>
        </div>
      </div>
      <DocumentIssueStrip issues={combinedIssues} />
    </div>
  );

  const tabLabel = (k: EmployeeTabId) => t(`employees.tabs.${k}.nav`);

  return (
    <DocumentPageLayout
      breadcrumbItems={[
        { label: t("routes.employees"), to: "/employees" },
        { label: isNew ? t("common.new") : draft.identity.employeeCode },
      ]}
      breadcrumbPrefix={<BackButton to={appendReturnTo("/employees", returnTo)} />}
      header={header}
      summary={false}
    >
      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as EmployeeTabId)} className="flex min-h-0 flex-1 flex-col gap-3">
        <Tabs.List
          className={cn(
            "flex w-full min-w-0 flex-wrap gap-1 border-b border-border bg-background/95 pb-1",
            "sticky top-0 z-[2]",
          )}
          aria-label={t("employees.page.tabsAria")}
        >
          {EMPLOYEE_TAB_IDS.map((tabId) => (
            <Tabs.Trigger
              key={tabId}
              value={tabId}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                "hover:bg-muted/60 hover:text-foreground",
                "data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-sm",
              )}
            >
              {tabLabel(tabId)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="main" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeMainTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
        <Tabs.Content value="org" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeOrgTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
        <Tabs.Content value="contacts" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeContactsTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
        <Tabs.Content value="access" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeAccessTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
        <Tabs.Content value="businessRoles" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeBusinessRolesTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
        <Tabs.Content value="linked" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeLinkedTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
        <Tabs.Content value="files" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeFilesTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
        <Tabs.Content value="availability" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeAvailabilityTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
        <Tabs.Content value="history" className="min-h-0 flex-1 outline-none focus-visible:outline-none">
          <EmployeeHistoryTab draft={draft} patch={patch} selfId={id} />
        </Tabs.Content>
      </Tabs.Root>
    </DocumentPageLayout>
  );
}
