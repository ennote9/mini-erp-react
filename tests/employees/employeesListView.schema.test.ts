import { describe, it, expect } from "vitest";
import { buildEmployeesTableSchema } from "@/modules/employees/employeesTableSchema";
import { buildEmployeeListRows } from "@/modules/employees/employeeListRowModel";
import { employeeRepository } from "@/modules/employees/repository";

const t = (key: string) => key;

describe("employees list view schema", () => {
  it("registers a broad field set with a compact default-visible subset", () => {
    const schema = buildEmployeesTableSchema({ t });
    expect(schema.length).toBeGreaterThan(15);
    const defaultVisible = schema.filter((c) => c.defaultVisible).map((c) => c.id);
    expect(defaultVisible).toContain("lineNo");
    expect(defaultVisible).toContain("employeeCode");
    expect(defaultVisible).toContain("fullName");
    expect(defaultVisible).toContain("employmentType");
    expect(defaultVisible).toContain("workSchedule");
    expect(defaultVisible).not.toContain("displayName");
    expect(defaultVisible).not.toContain("iin");
    expect(schema.find((c) => c.id === "displayName")?.defaultVisible).toBe(false);
  });

  it("buildEmployeeListRows exposes all schema accessor keys", () => {
    const rows = buildEmployeeListRows(employeeRepository.list());
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0]!;
    const schema = buildEmployeesTableSchema({ t });
    for (const col of schema) {
      if (!col.accessorKey) continue;
      expect(Object.prototype.hasOwnProperty.call(row, col.accessorKey)).toBe(true);
    }
  });
});
