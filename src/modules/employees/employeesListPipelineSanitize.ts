import type { ListViewColumnFilterModel } from "@/shared/navigation/listViewColumnFilters";
import type { ListViewUrlSort } from "@/shared/navigation/listViewUrlSort";
import type { EmployeesTableColumnSchema } from "./employeesTableSchema";

export function employeeListAllowedColumnIdSet(schema: EmployeesTableColumnSchema[]): ReadonlySet<string> {
  return new Set(schema.map((column) => column.id));
}

export function sanitizeEmployeesColumnFilterModel(
  model: ListViewColumnFilterModel,
  allowed: ReadonlySet<string>,
): ListViewColumnFilterModel {
  const next: ListViewColumnFilterModel = {};
  for (const [id, clause] of Object.entries(model)) {
    if (allowed.has(id)) next[id] = clause;
  }
  return next;
}

export function sanitizeEmployeesUrlSort(sort: ListViewUrlSort[], allowed: ReadonlySet<string>): ListViewUrlSort[] {
  return sort.filter((entry) => allowed.has(entry.colId));
}
