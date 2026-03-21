export type MessageTree = Record<string, unknown>;

function getLeafString(tree: MessageTree | undefined, path: string): string | undefined {
  if (!tree) return undefined;
  const parts = path.split(".");
  let cur: unknown = tree;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export type TranslateParams = Record<string, string | number | undefined>;

/**
 * Resolve a dotted path against primary then fallback message trees.
 * Missing keys: dev console warn, return last segment of path (no raw key spam with full path).
 */
export function createTranslator(
  primary: MessageTree,
  fallback: MessageTree,
  locale: string,
): (path: string, params?: TranslateParams) => string {
  return (path: string, params?: TranslateParams): string => {
    let raw = getLeafString(primary, path) ?? getLeafString(fallback, path);
    if (raw === undefined) {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] missing key "${path}" (locale=${locale})`);
      }
      const last = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1) : path;
      raw = last;
    }
    if (params) {
      return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => {
        const v = params[k];
        return v === undefined || v === null ? "" : String(v);
      });
    }
    return raw;
  };
}

export type TFunction = ReturnType<typeof createTranslator>;
