import { vi } from "vitest";

vi.mock("@tauri-apps/plugin-fs", async () => {
  const mock = await import("./support/tauriFsMock");
  return {
    BaseDirectory: mock.BaseDirectory,
    mkdir: mock.mkdir,
    exists: mock.exists,
    readFile: mock.readFile,
    writeFile: mock.writeFile,
    remove: mock.remove,
    rename: mock.rename,
  };
});
