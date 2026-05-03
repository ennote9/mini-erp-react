import { describe, expect, it } from "vitest";
import { createTranslator } from "../../src/shared/i18n/resolve";
import { enMessages } from "../../src/shared/i18n/messages/en";

describe("doc.list empty-state i18n keys", () => {
  it("resolves noRowsTrueEmptyTitle and noRowsTrueEmptyHint in English", () => {
    const t = createTranslator(enMessages, enMessages, "en");
    expect(t("doc.list.noRowsTrueEmptyTitle")).toBe("No records yet");
    expect(t("doc.list.noRowsTrueEmptyHint")).toBe(
      "Create the first record or import data to start using this list.",
    );
  });
});
