import type { CreateEmployeeInput, Employee, UpdateEmployeePatch } from "./model";
import {
  defaultAccessProfile,
  defaultAvailability,
  defaultBusinessRoles,
  defaultContacts,
  defaultIdentity,
  defaultLinkedSummaries,
  defaultOrg,
  normalizeAssignmentScope,
  normalizeAuditEvent,
  normalizeBusinessFile,
} from "./defaults";
import {
  getMasterDataFilePath,
  loadMasterDataPersisted,
  writeMasterDataPayload,
} from "@/shared/masterDataPersistence";
import { registerPersistenceFlush } from "@/shared/persistenceCoordinator";
import { bumpAppReadModelRevision } from "@/shared/appReadModelRevision";

const store: Employee[] = [];
let nextId = 1;
let persistChain: Promise<void> = Promise.resolve();
let persistDepth = 0;
let lastWriteError: string | null = null;

const PERSIST_PATH = getMasterDataFilePath("employees.json");

function asStr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function normalizeLinkedRefs(v: unknown): import("./model").LinkedEntityRef[] {
  if (!Array.isArray(v)) return [];
  const out: import("./model").LinkedEntityRef[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.name !== "string") continue;
    out.push({
      id: r.id,
      name: r.name,
      changedAt: typeof r.changedAt === "string" ? r.changedAt : undefined,
      status: typeof r.status === "string" ? r.status : undefined,
    });
  }
  return out;
}

function normalizeLinkedSummaries(raw: unknown): Employee["linkedSummaries"] {
  const base = defaultLinkedSummaries();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  return {
    assignedCategories: normalizeLinkedRefs(r.assignedCategories),
    assignedBrands: normalizeLinkedRefs(r.assignedBrands),
    assignedWarehouses: normalizeLinkedRefs(r.assignedWarehouses),
    documentTemplates: normalizeLinkedRefs(r.documentTemplates),
    createdObjectsPreview: normalizeLinkedRefs(r.createdObjectsPreview),
    approvedObjectsPreview: normalizeLinkedRefs(r.approvedObjectsPreview),
    inWorkObjectsPreview: normalizeLinkedRefs(r.inWorkObjectsPreview),
  };
}

function normalizeIdentity(raw: unknown): Employee["identity"] {
  const base = defaultIdentity();
  if (!raw || typeof raw !== "object") return base;
  const i = raw as Record<string, unknown>;
  return {
    employeeCode: asStr(i.employeeCode, base.employeeCode),
    personnelNumber: asStr(i.personnelNumber, base.personnelNumber),
    fullName: asStr(i.fullName, base.fullName),
    displayName: asStr(i.displayName, base.displayName),
    status: (asStr(i.status, base.status) as Employee["identity"]["status"]) || base.status,
    positionCode: asStr(i.positionCode, base.positionCode),
    departmentCode: asStr(i.departmentCode, base.departmentCode),
    comment: asStr(i.comment, base.comment),
    photoDataUrl: typeof i.photoDataUrl === "string" ? i.photoDataUrl : i.photoDataUrl === null ? null : base.photoDataUrl,
    employmentStartDate: asStr(i.employmentStartDate, base.employmentStartDate),
    employmentEndDate: typeof i.employmentEndDate === "string" || i.employmentEndDate === null ? (i.employmentEndDate as string | null) : base.employmentEndDate,
    primarySystemRoleCode: asStr(i.primarySystemRoleCode, base.primarySystemRoleCode),
    directManagerId: typeof i.directManagerId === "string" ? i.directManagerId : i.directManagerId === null ? null : base.directManagerId,
  };
}

function normalizeContacts(raw: unknown): Employee["contacts"] {
  const base = defaultContacts();
  if (!raw || typeof raw !== "object") return base;
  const c = raw as Record<string, unknown>;
  return {
    workEmail: asStr(c.workEmail, base.workEmail),
    workPhone: asStr(c.workPhone, base.workPhone),
    internalExtension: asStr(c.internalExtension, base.internalExtension),
    corporateMessengerId: asStr(c.corporateMessengerId, base.corporateMessengerId),
    officeLocation: asStr(c.officeLocation, base.officeLocation),
  };
}

function normalizeOrg(raw: unknown): Employee["org"] {
  const base = defaultOrg();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const scopesRaw = o.assignmentScopes;
  const scopes: Employee["org"]["assignmentScopes"] = [];
  if (Array.isArray(scopesRaw)) {
    for (const s of scopesRaw) {
      const n = normalizeAssignmentScope(s);
      if (n) scopes.push(n);
    }
  }
  return {
    departmentCode: asStr(o.departmentCode, base.departmentCode),
    positionCode: asStr(o.positionCode, base.positionCode),
    directManagerId: typeof o.directManagerId === "string" ? o.directManagerId : o.directManagerId === null ? null : base.directManagerId,
    functionalManagerId:
      typeof o.functionalManagerId === "string"
        ? o.functionalManagerId
        : o.functionalManagerId === null
          ? null
          : base.functionalManagerId,
    teamOrGroup: asStr(o.teamOrGroup, base.teamOrGroup),
    responsibilityZone: asStr(o.responsibilityZone, base.responsibilityZone),
    assignmentScopes: scopes,
  };
}

function normalizeAccess(raw: unknown): Employee["access"] {
  const base = defaultAccessProfile();
  if (!raw || typeof raw !== "object") return base;
  const a = raw as Record<string, unknown>;
  return {
    isErpUser: asBool(a.isErpUser, base.isErpUser),
    login: asStr(a.login, base.login),
    primaryRoleCode: asStr(a.primaryRoleCode, base.primaryRoleCode),
    additionalRoleCodes: asStrArray(a.additionalRoleCodes),
    permissionGroupCode: asStr(a.permissionGroupCode, base.permissionGroupCode),
    accessStatus: (asStr(a.accessStatus, base.accessStatus) as Employee["access"]["accessStatus"]) || base.accessStatus,
    lastLoginAt: typeof a.lastLoginAt === "string" || a.lastLoginAt === null ? (a.lastLoginAt as string | null) : base.lastLoginAt,
    isAdministrator: asBool(a.isAdministrator, base.isAdministrator),
    allowedModuleCodes: asStrArray(a.allowedModuleCodes),
    warehouseScopeIds: asStrArray(a.warehouseScopeIds),
    categoryScopeIds: asStrArray(a.categoryScopeIds),
    brandScopeIds: asStrArray(a.brandScopeIds),
    priceVisibility: (asStr(a.priceVisibility, base.priceVisibility) as Employee["access"]["priceVisibility"]) || base.priceVisibility,
    canApprove: asBool(a.canApprove, base.canApprove),
    canReview: asBool(a.canReview, base.canReview),
    canEditMaster: asBool(a.canEditMaster, base.canEditMaster),
    canDeleteDocuments: asBool(a.canDeleteDocuments, base.canDeleteDocuments),
    canArchive: asBool(a.canArchive, base.canArchive),
    financeVisibility:
      (asStr(a.financeVisibility, base.financeVisibility) as Employee["access"]["financeVisibility"]) ||
      base.financeVisibility,
  };
}

function normalizeBusinessRoles(raw: unknown): Employee["businessRoles"] {
  const base = defaultBusinessRoles();
  if (!raw || typeof raw !== "object") return base;
  const b = raw as Record<string, unknown>;
  const roles: Employee["businessRoles"]["assignedRoles"] = [];
  if (Array.isArray(b.assignedRoles)) {
    for (const r of b.assignedRoles) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      if (typeof o.roleCode !== "string") continue;
      roles.push({
        roleCode: o.roleCode,
        description: asStr(o.description, ""),
        objectsHint: asStr(o.objectsHint, ""),
      });
    }
  }
  const parts: Employee["businessRoles"]["processParticipations"] = [];
  if (Array.isArray(b.processParticipations)) {
    for (const r of b.processParticipations) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      if (typeof o.participationType !== "string" || typeof o.detail !== "string") continue;
      parts.push({ participationType: o.participationType, detail: o.detail });
    }
  }
  const appr: string[] = [];
  if (Array.isArray(b.approvalResponsibilities)) {
    for (const x of b.approvalResponsibilities) {
      if (typeof x === "string") appr.push(x);
    }
  }
  return {
    assignedRoles: roles,
    processParticipations: parts,
    approvalResponsibilities: appr,
    canDoubleCheck: asBool(b.canDoubleCheck, base.canDoubleCheck),
    canFinalApprove: asBool(b.canFinalApprove, base.canFinalApprove),
    responsibleForObjectsNote: asStr(b.responsibleForObjectsNote, base.responsibleForObjectsNote),
  };
}

function normalizeAvailability(raw: unknown): Employee["availability"] {
  const base = defaultAvailability();
  if (!raw || typeof raw !== "object") return base;
  const a = raw as Record<string, unknown>;
  return {
    kind: (asStr(a.kind, base.kind) as Employee["availability"]["kind"]) || base.kind,
    periodStart: asStr(a.periodStart, base.periodStart),
    periodEnd: typeof a.periodEnd === "string" || a.periodEnd === null ? (a.periodEnd as string | null) : base.periodEnd,
    substituteEmployeeId:
      typeof a.substituteEmployeeId === "string"
        ? a.substituteEmployeeId
        : a.substituteEmployeeId === null
          ? null
          : base.substituteEmployeeId,
    comment: asStr(a.comment, base.comment),
  };
}

function normalizeEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== "string") return null;
  const audit: Employee["audit"] = [];
  if (Array.isArray(rec.audit)) {
    for (const e of rec.audit) {
      const n = normalizeAuditEvent(e);
      if (n) audit.push(n);
    }
  }
  const files: Employee["files"] = [];
  if (Array.isArray(rec.files)) {
    for (const f of rec.files) {
      const n = normalizeBusinessFile(f);
      if (n) files.push(n);
    }
  }
  const entity: Employee = {
    id: rec.id,
    identity: normalizeIdentity(rec.identity),
    contacts: normalizeContacts(rec.contacts),
    org: normalizeOrg(rec.org),
    access: normalizeAccess(rec.access),
    businessRoles: normalizeBusinessRoles(rec.businessRoles),
    linkedSummaries: normalizeLinkedSummaries(rec.linkedSummaries),
    availability: normalizeAvailability(rec.availability),
    files,
    audit,
  };
  if (!entity.identity.employeeCode.trim() || !entity.identity.fullName.trim()) return null;
  return entity;
}

function schedulePersist(): void {
  bumpAppReadModelRevision();
  persistDepth++;
  persistChain = persistChain
    .then(async () => {
      try {
        await writeMasterDataPayload(PERSIST_PATH, [...store]);
        lastWriteError = null;
      } catch (e) {
        lastWriteError = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[employeeRepository] persist failed:", e);
        }
      }
    })
    .finally(() => {
      persistDepth--;
    });
}

export function getEmployeePersistBusy(): boolean {
  return persistDepth > 0;
}

export async function flushPendingEmployeePersist(): Promise<void> {
  await persistChain;
  if (lastWriteError) throw new Error(lastWriteError);
}

function nextIdStr(): string {
  return String(nextId++);
}

function buildSeedEmployees(): CreateEmployeeInput[] {
  const t0 = "2024-01-15T09:00:00.000Z";
  const t1 = "2024-06-01T14:22:00.000Z";
  return [
    {
      identity: {
        employeeCode: "EMP-0001",
        personnelNumber: "P-10001",
        fullName: "Alexandra Morgan",
        displayName: "A. Morgan",
        status: "active",
        positionCode: "FIN_CONTROLLER",
        departmentCode: "FINANCE",
        comment: "Regional sign-off for supplier invoices above threshold.",
        photoDataUrl: null,
        employmentStartDate: "2019-03-01",
        employmentEndDate: null,
        primarySystemRoleCode: "FINANCE",
        directManagerId: null,
      },
      contacts: {
        workEmail: "a.morgan@company.example",
        workPhone: "+1 555 0101",
        internalExtension: "4101",
        corporateMessengerId: "corp://users/amorgan",
        officeLocation: "HQ — Finance wing",
      },
      org: {
        departmentCode: "FINANCE",
        positionCode: "FIN_CONTROLLER",
        directManagerId: null,
        functionalManagerId: null,
        teamOrGroup: "Finance Ops North",
        responsibilityZone: "North region — payables",
        assignmentScopes: [
          { kind: "document_type", entityId: "PO", label: "Purchase orders" },
          { kind: "business_direction", entityId: "RETAIL", label: "Retail" },
        ],
      },
      access: {
        isErpUser: true,
        login: "amorgan",
        primaryRoleCode: "FINANCE",
        additionalRoleCodes: ["REPORTING"],
        permissionGroupCode: "FINANCE_FULL",
        accessStatus: "active",
        lastLoginAt: t1,
        isAdministrator: false,
        allowedModuleCodes: ["purchase-orders", "receipts", "items"],
        warehouseScopeIds: ["1"],
        categoryScopeIds: [],
        brandScopeIds: [],
        priceVisibility: "extended",
        canApprove: true,
        canReview: true,
        canEditMaster: false,
        canDeleteDocuments: false,
        canArchive: true,
        financeVisibility: "full",
      },
      businessRoles: {
        assignedRoles: [
          { roleCode: "FINANCIAL_CONTROLLER", description: "SO/PO cost checks", objectsHint: "Sales & purchase orders" },
        ],
        processParticipations: [{ participationType: "Payment batch review", detail: "Weekly batch sign-off" }],
        approvalResponsibilities: ["PO second approval > 50k", "Markdown journal reviewer"],
        canDoubleCheck: true,
        canFinalApprove: true,
        responsibleForObjectsNote: "Pricing files for assigned brands (see Linked).",
      },
      linkedSummaries: {
        assignedCategories: [{ id: "1", name: "Electronics", changedAt: t0 }],
        assignedBrands: [{ id: "1", name: "Acme", changedAt: t0 }],
        assignedWarehouses: [{ id: "1", name: "Main DC", status: "active" }],
        documentTemplates: [{ id: "tpl-po", name: "PO approval checklist" }],
        createdObjectsPreview: [{ id: "SO-1042", name: "Sales order SO-1042", changedAt: t1, status: "confirmed" }],
        approvedObjectsPreview: [{ id: "PO-882", name: "Purchase order PO-882", changedAt: t0, status: "confirmed" }],
        inWorkObjectsPreview: [{ id: "SO-1101", name: "Sales order SO-1101", changedAt: t1, status: "draft" }],
      },
      availability: {
        kind: "active",
        periodStart: "",
        periodEnd: null,
        substituteEmployeeId: null,
        comment: "",
      },
      files: [
        {
          id: "f1",
          fileKind: "agreement",
          title: "Delegated approval matrix (2025)",
          uploadedAt: t0,
          comment: "Internal policy reference",
        },
      ],
      audit: [
        {
          id: "a1",
          at: t0,
          actorEmployeeId: null,
          actorLabel: "System",
          kind: "created",
          summary: "Employee record created",
        },
        {
          id: "a2",
          at: t1,
          actorEmployeeId: "2",
          actorLabel: "R. Chen",
          kind: "roles_changed",
          summary: "Reporting role added",
          details: "+REPORTING",
        },
      ],
    },
    {
      identity: {
        employeeCode: "EMP-0002",
        personnelNumber: "P-10002",
        fullName: "Robert Chen",
        displayName: "R. Chen",
        status: "active",
        positionCode: "WAREHOUSE_LEAD",
        departmentCode: "LOGISTICS",
        comment: "Shift lead — inbound scheduling.",
        photoDataUrl: null,
        employmentStartDate: "2021-07-12",
        employmentEndDate: null,
        primarySystemRoleCode: "OPERATIONS",
        directManagerId: "1",
      },
      contacts: {
        workEmail: "r.chen@company.example",
        workPhone: "+1 555 0102",
        internalExtension: "2202",
        corporateMessengerId: "corp://users/rchen",
        officeLocation: "DC-01 — receiving desk",
      },
      org: {
        departmentCode: "LOGISTICS",
        positionCode: "WAREHOUSE_LEAD",
        directManagerId: "1",
        functionalManagerId: null,
        teamOrGroup: "Inbound crew A",
        responsibilityZone: "Receiving dock 1–4",
        assignmentScopes: [
          { kind: "warehouse", entityId: "1", label: "Main DC" },
          { kind: "category", entityId: "2", label: "Fasteners" },
        ],
      },
      access: {
        isErpUser: true,
        login: "rchen",
        primaryRoleCode: "OPERATIONS",
        additionalRoleCodes: [],
        permissionGroupCode: "WAREHOUSE_OPS",
        accessStatus: "active",
        lastLoginAt: "2025-04-10T11:05:00.000Z",
        isAdministrator: false,
        allowedModuleCodes: ["receipts", "shipments", "stock-balances"],
        warehouseScopeIds: ["1"],
        categoryScopeIds: ["2"],
        brandScopeIds: [],
        priceVisibility: "none",
        canApprove: false,
        canReview: true,
        canEditMaster: false,
        canDeleteDocuments: false,
        canArchive: false,
        financeVisibility: "none",
      },
      businessRoles: {
        assignedRoles: [
          { roleCode: "WAREHOUSE_EMPLOYEE", description: "Stock moves & receipts", objectsHint: "Receipts, shipments" },
          { roleCode: "OPERATOR", description: "Barcode corrections", objectsHint: "Items / barcodes" },
        ],
        processParticipations: [{ participationType: "Cycle count", detail: "Quarterly wall-to-wall" }],
        approvalResponsibilities: [],
        canDoubleCheck: true,
        canFinalApprove: false,
        responsibleForObjectsNote: "Physical custody of returned goods staging.",
      },
      linkedSummaries: {
        assignedCategories: [{ id: "2", name: "Fasteners" }],
        assignedBrands: [],
        assignedWarehouses: [{ id: "1", name: "Main DC" }],
        documentTemplates: [],
        createdObjectsPreview: [],
        approvedObjectsPreview: [],
        inWorkObjectsPreview: [{ id: "REC-301", name: "Receipt REC-301", changedAt: t1, status: "draft" }],
      },
      availability: {
        kind: "active",
        periodStart: "",
        periodEnd: null,
        substituteEmployeeId: null,
        comment: "",
      },
      files: [],
      audit: [
        {
          id: "b1",
          at: t0,
          actorLabel: "System",
          actorEmployeeId: null,
          kind: "created",
          summary: "Employee record created",
        },
      ],
    },
    {
      identity: {
        employeeCode: "EMP-0003",
        personnelNumber: "P-10003",
        fullName: "Samira Okonkwo",
        displayName: "S. Okonkwo",
        status: "inactive",
        positionCode: "BUYER",
        departmentCode: "PURCHASING",
        comment: "Former buyer — record retained for audit trail.",
        photoDataUrl: null,
        employmentStartDate: "2018-05-01",
        employmentEndDate: "2024-12-31",
        primarySystemRoleCode: "VIEWER",
        directManagerId: null,
      },
      contacts: {
        workEmail: "s.okonkwo@company.example",
        workPhone: "",
        internalExtension: "",
        corporateMessengerId: "",
        officeLocation: "Former — London satellite",
      },
      org: {
        departmentCode: "PURCHASING",
        positionCode: "BUYER",
        directManagerId: null,
        functionalManagerId: null,
        teamOrGroup: "",
        responsibilityZone: "",
        assignmentScopes: [{ kind: "supplier", entityId: "1", label: "Acme Supplies" }],
      },
      access: {
        isErpUser: false,
        login: "",
        primaryRoleCode: "VIEWER",
        additionalRoleCodes: [],
        permissionGroupCode: "NONE",
        accessStatus: "blocked",
        lastLoginAt: "2024-11-02T08:00:00.000Z",
        isAdministrator: false,
        allowedModuleCodes: [],
        warehouseScopeIds: [],
        categoryScopeIds: [],
        brandScopeIds: [],
        priceVisibility: "none",
        canApprove: false,
        canReview: false,
        canEditMaster: false,
        canDeleteDocuments: false,
        canArchive: false,
        financeVisibility: "none",
      },
      businessRoles: {
        assignedRoles: [{ roleCode: "BUYER", description: "Legacy", objectsHint: "Historical PO lines" }],
        processParticipations: [],
        approvalResponsibilities: [],
        canDoubleCheck: false,
        canFinalApprove: false,
        responsibleForObjectsNote: "",
      },
      linkedSummaries: defaultLinkedSummaries(),
      availability: {
        kind: "dismissed",
        periodStart: "2024-12-01",
        periodEnd: "2024-12-31",
        substituteEmployeeId: null,
        comment: "Offboarding completed; access revoked.",
      },
      files: [
        {
          id: "f2",
          fileKind: "access",
          title: "Access revocation checklist",
          uploadedAt: "2024-12-20T10:00:00.000Z",
          comment: "IT + security sign-off",
        },
      ],
      audit: [
        { id: "c1", at: t0, actorLabel: "System", actorEmployeeId: null, kind: "created", summary: "Employee record created" },
        {
          id: "c2",
          at: "2024-12-20T10:00:00.000Z",
          actorLabel: "Security bot",
          actorEmployeeId: null,
          kind: "access_block",
          summary: "ERP access blocked",
        },
        {
          id: "c3",
          at: "2024-12-31T18:00:00.000Z",
          actorLabel: "HR Ops",
          actorEmployeeId: null,
          kind: "deactivated",
          summary: "Employment ended",
        },
      ],
    },
    {
      identity: {
        employeeCode: "EMP-0004",
        personnelNumber: "P-10004",
        fullName: "Jordan Lee",
        displayName: "J. Lee",
        status: "active",
        positionCode: "CONTENT_MANAGER",
        departmentCode: "MERCH",
        comment: "Catalog enrichment and seasonal assortment.",
        photoDataUrl: null,
        employmentStartDate: "2023-01-09",
        employmentEndDate: null,
        primarySystemRoleCode: "MERCH",
        directManagerId: "1",
      },
      contacts: {
        workEmail: "j.lee@company.example",
        workPhone: "+1 555 0104",
        internalExtension: "3304",
        corporateMessengerId: "corp://users/jlee",
        officeLocation: "HQ — Merch studio",
      },
      org: {
        departmentCode: "MERCH",
        positionCode: "CONTENT_MANAGER",
        directManagerId: "1",
        functionalManagerId: null,
        teamOrGroup: "Assortment studio",
        responsibilityZone: "Private label accessories",
        assignmentScopes: [
          { kind: "brand", entityId: "1", label: "Acme" },
          { kind: "category", entityId: "1", label: "Electronics" },
        ],
      },
      access: {
        isErpUser: true,
        login: "jlee",
        primaryRoleCode: "MERCH",
        additionalRoleCodes: [],
        permissionGroupCode: "MERCH_EDIT",
        accessStatus: "active",
        lastLoginAt: null,
        isAdministrator: false,
        allowedModuleCodes: ["items", "brands", "categories", "barcodes"],
        warehouseScopeIds: [],
        categoryScopeIds: ["1"],
        brandScopeIds: ["1"],
        priceVisibility: "standard",
        canApprove: false,
        canReview: true,
        canEditMaster: true,
        canDeleteDocuments: false,
        canArchive: false,
        financeVisibility: "limited",
      },
      businessRoles: {
        assignedRoles: [
          { roleCode: "CONTENT_MANAGER", description: "Item attributes & media", objectsHint: "Items" },
          { roleCode: "BRAND_MANAGER", description: "Assigned brand Acme", objectsHint: "Brand policy" },
        ],
        processParticipations: [{ participationType: "New item gate", detail: "Quality checklist before activation" }],
        approvalResponsibilities: ["Item activation (non-financial)"],
        canDoubleCheck: false,
        canFinalApprove: false,
        responsibleForObjectsNote: "SKU copy and attribute completeness.",
      },
      linkedSummaries: {
        assignedCategories: [{ id: "1", name: "Electronics" }],
        assignedBrands: [{ id: "1", name: "Acme" }],
        assignedWarehouses: [],
        documentTemplates: [{ id: "tpl-item", name: "Item activation checklist" }],
        createdObjectsPreview: [{ id: "ITEM-9001", name: "New SKU draft", changedAt: t1, status: "draft" }],
        approvedObjectsPreview: [],
        inWorkObjectsPreview: [],
      },
      availability: {
        kind: "vacation",
        periodStart: "2025-04-14",
        periodEnd: "2025-04-28",
        substituteEmployeeId: "2",
        comment: "Delegated warehouse communications to lead during leave.",
      },
      files: [],
      audit: [{ id: "d1", at: t0, actorLabel: "System", actorEmployeeId: null, kind: "created", summary: "Employee record created" }],
    },
  ];
}

function buildSeedRecords(): Employee[] {
  return buildSeedEmployees().map((input, i) => ({ ...input, id: String(i + 1) }));
}

async function bootstrapFromDisk(): Promise<void> {
  const loaded = await loadMasterDataPersisted({
    relativePath: PERSIST_PATH,
    buildSeedRecords,
    normalizeRecord: normalizeEmployee,
    diagnosticsTag: "employeeRepository",
  });
  if (loaded.diagnostics && import.meta.env.DEV) {
    console.warn(loaded.diagnostics);
  }
  store.splice(0, store.length, ...loaded.records);
  nextId = loaded.nextId;
}

export const employeeRepository = {
  list(): Employee[] {
    return [...store];
  },

  getById(id: string): Employee | undefined {
    return store.find((x) => x.id === id);
  },

  create(input: CreateEmployeeInput): Employee {
    const entity: Employee = { ...input, id: nextIdStr() };
    store.push(entity);
    schedulePersist();
    return entity;
  },

  update(id: string, patch: UpdateEmployeePatch): Employee | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    const prev = store[i];
    const next: Employee = {
      ...prev,
      ...patch,
      identity: patch.identity ? { ...prev.identity, ...patch.identity } : prev.identity,
      contacts: patch.contacts ? { ...prev.contacts, ...patch.contacts } : prev.contacts,
      org: patch.org ? { ...prev.org, ...patch.org, assignmentScopes: patch.org.assignmentScopes ?? prev.org.assignmentScopes } : prev.org,
      access: patch.access ? { ...prev.access, ...patch.access } : prev.access,
      businessRoles: patch.businessRoles
        ? { ...prev.businessRoles, ...patch.businessRoles }
        : prev.businessRoles,
      linkedSummaries: patch.linkedSummaries
        ? { ...prev.linkedSummaries, ...patch.linkedSummaries }
        : prev.linkedSummaries,
      availability: patch.availability ? { ...prev.availability, ...patch.availability } : prev.availability,
      files: patch.files ?? prev.files,
      audit: patch.audit ?? prev.audit,
    };
    store[i] = next;
    schedulePersist();
    return next;
  },

  replace(id: string, entity: Employee): Employee | undefined {
    const i = store.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    store[i] = { ...entity, id };
    schedulePersist();
    return store[i];
  },

  search(query: string): Employee[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...store];
    return store.filter((x) => {
      const idn = x.identity;
      return (
        idn.employeeCode.toLowerCase().includes(q) ||
        idn.fullName.toLowerCase().includes(q) ||
        idn.displayName.toLowerCase().includes(q) ||
        idn.personnelNumber.toLowerCase().includes(q) ||
        x.access.login.toLowerCase().includes(q)
      );
    });
  },
};

await bootstrapFromDisk();
registerPersistenceFlush({
  id: "employees",
  flush: flushPendingEmployeePersist,
  isBusy: getEmployeePersistBusy,
});
