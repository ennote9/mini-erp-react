type FsEntry = Uint8Array;
type WriteFailureRule = {
  pathIncludes: string;
  remaining: number;
  message: string;
};

type MockFsState = {
  files: Map<string, FsEntry>;
  writeFailures: WriteFailureRule[];
};

const MOCK_FS_STATE_KEY = "__mini_erp_test_mock_fs_state__";

function getState(): MockFsState {
  const root = globalThis as typeof globalThis & {
    [MOCK_FS_STATE_KEY]?: MockFsState;
  };
  if (!root[MOCK_FS_STATE_KEY]) {
    root[MOCK_FS_STATE_KEY] = {
      files: new Map<string, FsEntry>(),
      writeFailures: [],
    };
  }
  return root[MOCK_FS_STATE_KEY]!;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+/g, "/");
}

function cloneBytes(input: Uint8Array): Uint8Array {
  return new Uint8Array(input);
}

export function resetMockFs(): void {
  const state = getState();
  state.files.clear();
  state.writeFailures.length = 0;
}

export function listMockFsPaths(): string[] {
  return [...getState().files.keys()].sort();
}

export function injectWriteFileFailure(
  pathIncludes: string,
  options?: { times?: number; message?: string },
): void {
  getState().writeFailures.push({
    pathIncludes: normalizePath(pathIncludes),
    remaining: options?.times ?? 1,
    message: options?.message ?? `Injected write failure for ${pathIncludes}`,
  });
}

export function clearMockFsFailures(): void {
  getState().writeFailures.length = 0;
}

export const BaseDirectory = {
  AppLocalData: "AppLocalData",
} as const;

export async function mkdir(_path: string, _options?: unknown): Promise<void> {
  // Directory structure is implicit in the path map for tests.
}

export async function exists(path: string, _options?: unknown): Promise<boolean> {
  return getState().files.has(normalizePath(path));
}

export async function readFile(path: string, _options?: unknown): Promise<Uint8Array> {
  const hit = getState().files.get(normalizePath(path));
  if (!hit) {
    throw new Error(`ENOENT: ${path}`);
  }
  return cloneBytes(hit);
}

export async function writeFile(
  path: string,
  contents: string | Uint8Array | ArrayBuffer,
  _options?: unknown,
): Promise<void> {
  const normalized = normalizePath(path);
  const failure = getState().writeFailures.find(
    (rule) => rule.remaining > 0 && normalized.includes(rule.pathIncludes),
  );
  if (failure) {
    failure.remaining -= 1;
    throw new Error(failure.message);
  }
  const bytes =
    typeof contents === "string"
      ? new TextEncoder().encode(contents)
      : contents instanceof Uint8Array
        ? contents
        : new Uint8Array(contents);
  getState().files.set(normalized, cloneBytes(bytes));
}

export async function remove(path: string, _options?: unknown): Promise<void> {
  getState().files.delete(normalizePath(path));
}

export async function rename(
  oldPath: string,
  newPath: string,
  _options?: unknown,
): Promise<void> {
  const oldKey = normalizePath(oldPath);
  const state = getState();
  const hit = state.files.get(oldKey);
  if (!hit) {
    throw new Error(`ENOENT: ${oldPath}`);
  }
  state.files.set(normalizePath(newPath), cloneBytes(hit));
  state.files.delete(oldKey);
}
