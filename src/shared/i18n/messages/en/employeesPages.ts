/** Employees module — list, detail tabs, bounded dictionaries. */
export const employeesPagesEn = {
  employees: {
    list: {
      columns: {
        employeeCode: "Employee code",
        fullName: "Full name",
        displayName: "Display name",
        status: "Status",
        position: "Position",
        department: "Department",
        manager: "Manager",
      },
    },
    page: {
      titleNew: "New employee",
      titleEdit: "Employee {{code}}",
      tabsAria: "Employee workspace sections",
    },
    header: {
      record: "Record",
    },
    messages: {
      saved: "Employee saved",
    },
    audit: {
      actorCurrentUser: "Current user",
    },
    validation: {
      codeRequired: "Employee code is required",
      fullNameRequired: "Full name is required",
      endBeforeStart: "Employment end date cannot be before start date",
    },
    placeholders: {
      none: "— None —",
    },
    fields: {
      employeeCode: "Employee code",
      personnelNumber: "Personnel number",
      fullName: "Full name",
      displayName: "Display name",
      status: "Record status",
      position: "Position",
      department: "Department",
      directManager: "Direct manager",
      employmentStart: "Employment start",
      employmentEnd: "Employment end",
      comment: "Comment",
      workEmail: "Work email",
      workPhone: "Work phone",
      internalExtension: "Internal extension",
      officeLocation: "Office / branch / location",
      functionalManager: "Functional manager",
      teamOrGroup: "Team / group",
      responsibilityZone: "Responsibility zone",
    },
    tabs: {
      main: {
        nav: "Main",
        identityTitle: "Core identity",
      },
      org: {
        nav: "Org & responsibility",
        structureTitle: "Organizational placement",
      },
      contacts: {
        nav: "Contacts",
        title: "Work contacts",
        messengerLabel: "Corp. messenger",
      },
    },
    enums: {
      recordStatus: {
        active: "Active",
        inactive: "Inactive",
        terminated: "Terminated",
      },
      accessStatus: {
        active: "Active",
        blocked: "Blocked",
        pending: "Pending",
      },
      availability: {
        active: "Active",
        vacation: "Vacation",
        sick_leave: "Sick leave",
        dismissed: "Dismissed",
        temporarily_unavailable: "Temporarily unavailable",
      },
    },
    dict: {
      department: {
        FINANCE: "Finance",
        LOGISTICS: "Logistics",
        PURCHASING: "Purchasing",
        MERCH: "Merchandising",
        OPS: "Operations",
        IT: "IT",
      },
      position: {
        FIN_CONTROLLER: "Financial controller",
        WAREHOUSE_LEAD: "Warehouse lead",
        BUYER: "Buyer",
        CONTENT_MANAGER: "Content manager",
        OPERATOR: "Operator",
        SYS_ADMIN: "System administrator",
      },
      systemRole: {
        VIEWER: "Viewer",
        OPERATIONS: "Operations",
        FINANCE: "Finance",
        MERCH: "Merchandising",
        ADMIN: "Administrator",
      },
    },
  },
};
