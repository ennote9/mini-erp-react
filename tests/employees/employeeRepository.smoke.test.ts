import { describe, it, expect } from "vitest";
import { employeeRepository } from "@/modules/employees/repository";

describe("employeeRepository", () => {
  it("exposes a non-empty seeded list in the default store", () => {
    const rows = employeeRepository.list();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.identity.employeeCode).toBeTruthy();
  });
});
