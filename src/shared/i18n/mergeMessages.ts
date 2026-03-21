import type { MessageTree } from "./resolve";

/** Deep-merge partial locale overrides onto English base (missing keys inherit English). */
export function mergeMessageTree(base: MessageTree, override: MessageTree): MessageTree {
  const out: MessageTree = { ...base };
  for (const key of Object.keys(override)) {
    const b = base[key];
    const o = override[key];
    if (
      o !== null &&
      typeof o === "object" &&
      !Array.isArray(o) &&
      b !== null &&
      typeof b === "object" &&
      !Array.isArray(b)
    ) {
      out[key] = mergeMessageTree(b as MessageTree, o as MessageTree);
    } else if (o !== undefined) {
      out[key] = o;
    }
  }
  return out;
}
