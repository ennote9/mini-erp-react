import type {
  Employee,
  EmployeeEmploymentType,
  EmployeeGender,
  EmployeeIdentityDocumentType,
  EmployeeRecordStatus,
  EmployeeWorkSchedule,
} from "./model";
import { employeeRepository } from "./repository";

export type EmployeeListRow = {
  id: string;
  employeeCode: string;
  personnelNumber: string;
  fullName: string;
  displayName: string;
  status: EmployeeRecordStatus;
  employmentStartDate: string;
  employmentEndDate: string;
  comment: string;
  dateOfBirth: string;
  gender: EmployeeGender;
  citizenship: string;
  iin: string;
  placeOfBirth: string;
  maritalStatus: string;
  personalPhone: string;
  personalEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  documentType: EmployeeIdentityDocumentType;
  documentNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  country: string;
  region: string;
  city: string;
  residentialAddress: string;
  registrationAddress: string;
  positionCode: string;
  departmentCode: string;
  managerDisplay: string;
  functionalManagerDisplay: string;
  teamOrGroup: string;
  responsibilityZone: string;
  employmentType: EmployeeEmploymentType;
  workSchedule: EmployeeWorkSchedule;
  shiftLabel: string;
  workEmail: string;
  workPhone: string;
  internalExtension: string;
  corporateMessengerId: string;
  officeLocation: string;
};

function managerDisplayForId(managerId: string | null): string {
  if (!managerId) return "";
  const m = employeeRepository.getById(managerId);
  return m ? m.identity.displayName || m.identity.fullName : managerId;
}

function managerDisplayForEmployee(e: Employee): string {
  return managerDisplayForId(e.org.directManagerId ?? e.identity.directManagerId);
}

function functionalManagerDisplayFor(e: Employee): string {
  return managerDisplayForId(e.org.functionalManagerId);
}

function str(v: string | null | undefined): string {
  return v ?? "";
}

export function buildEmployeeListRows(employees: Employee[]): EmployeeListRow[] {
  return employees.map((e) => {
    const idn = e.identity;
    const pp = e.personProfile;
    const o = e.org;
    const c = e.contacts;
    const doc = pp.identityDocument;
    const addr = pp.address;
    const per = pp.personal;

    return {
      id: e.id,
      employeeCode: idn.employeeCode,
      personnelNumber: idn.personnelNumber,
      fullName: idn.fullName,
      displayName: idn.displayName,
      status: idn.status,
      employmentStartDate: idn.employmentStartDate,
      employmentEndDate: str(idn.employmentEndDate),
      comment: idn.comment,
      dateOfBirth: per.dateOfBirth,
      gender: per.gender,
      citizenship: per.citizenship,
      iin: per.iin,
      placeOfBirth: per.placeOfBirth,
      maritalStatus: per.maritalStatus,
      personalPhone: per.personalPhone,
      personalEmail: per.personalEmail,
      emergencyContactName: per.emergencyContactName,
      emergencyContactPhone: per.emergencyContactPhone,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      issuingAuthority: doc.issuingAuthority,
      issueDate: doc.issueDate,
      expiryDate: str(doc.expiryDate),
      country: addr.country,
      region: addr.region,
      city: addr.city,
      residentialAddress: addr.residentialAddress,
      registrationAddress: addr.registrationAddress,
      positionCode: o.positionCode,
      departmentCode: o.departmentCode,
      managerDisplay: managerDisplayForEmployee(e),
      functionalManagerDisplay: functionalManagerDisplayFor(e),
      teamOrGroup: o.teamOrGroup,
      responsibilityZone: o.responsibilityZone,
      employmentType: o.employmentType,
      workSchedule: o.workSchedule,
      shiftLabel: o.shiftLabel,
      workEmail: c.workEmail,
      workPhone: c.workPhone,
      internalExtension: c.internalExtension,
      corporateMessengerId: c.corporateMessengerId,
      officeLocation: c.officeLocation,
    };
  });
}
