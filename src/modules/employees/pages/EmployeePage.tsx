import { useMatch, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs } from "radix-ui";
import type { LucideIcon } from "lucide-react";
import { Building2, ContactRound, Save, UserRound, X } from "lucide-react";
import { employeeRepository, flushPendingEmployeePersist } from "../repository";
import { createBlankEmployee, normalizeEmployeeForSave, buildAuditEventsForSave } from "../service";
import type { Employee } from "../model";
import { DocumentPageLayout } from "@/shared/ui/object/DocumentPageLayout";
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
import { cn } from "@/lib/utils";

const EMPLOYEE_TAB_ICONS = {
  main: UserRound,
  org: Building2,
  contacts: ContactRound,
} satisfies Record<EmployeeTabId, LucideIcon>;

function cloneEmployee(e: Employee): Employee {
  return JSON.parse(JSON.stringify(e)) as Employee;
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

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold leading-tight">{title}</h2>
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
      breadcrumbItems={[]}
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
          {EMPLOYEE_TAB_IDS.map((tabId) => {
            const TabIcon = EMPLOYEE_TAB_ICONS[tabId];
            return (
              <Tabs.Trigger
                key={tabId}
                value={tabId}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                  "hover:bg-muted/60 hover:text-foreground",
                  "data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                )}
              >
                <TabIcon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                <span>{tabLabel(tabId)}</span>
              </Tabs.Trigger>
            );
          })}
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
      </Tabs.Root>
    </DocumentPageLayout>
  );
}
