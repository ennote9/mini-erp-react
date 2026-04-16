import type { Employee } from "../../model";

export type EmployeeTabProps = {
  draft: Employee;
  patch: (fn: (prev: Employee) => Employee) => void;
  /** Exclude self from manager/substitute pickers */
  selfId?: string;
};
