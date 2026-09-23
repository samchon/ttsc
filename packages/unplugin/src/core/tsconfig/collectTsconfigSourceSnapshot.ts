import fs from "node:fs";
import { parseJsonc, tsconfigExtendsFileCandidates } from "ttsc/tsconfig";

import { extendsSpecifiers } from "./extendsSpecifiers";
import { resolveExtendsConfig } from "./resolveExtendsConfig";
import { resolveRealPath } from "./resolveRealPath";

/** Capture every config source independently of which option declares a value. */
export function collectTsconfigSourceSnapshot(
  tsconfig: string,
  seen: Set<string>,
  output: Map<string, string | null>,
): void {
  const canonical = resolveRealPath(tsconfig);
  if (seen.has(canonical)) return;
  seen.add(canonical);

  let contents: string;
  let parsed: { extends?: unknown };
  try {
    contents = fs.readFileSync(canonical, "utf8");
    output.set(canonical, contents);
    parsed = parseJsonc(contents) as typeof parsed;
  } catch {
    output.set(canonical, null);
    return;
  }
  if (typeof parsed !== "object" || parsed === null) return;

  for (const specifier of extendsSpecifiers(parsed.extends)) {
    const base = resolveExtendsConfig(canonical, specifier);
    if (base !== null) {
      collectTsconfigSourceSnapshot(base, seen, output);
      continue;
    }
    for (const candidate of tsconfigExtendsFileCandidates(
      canonical,
      specifier,
    ) ?? []) {
      if (!output.has(candidate)) output.set(candidate, null);
    }
  }
}
