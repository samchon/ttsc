import { createRequire } from "node:module";
import path from "node:path";

import { parseCommonJsExports } from "../parseCommonJsExports";
import { realPath } from "./realPath";

/**
 * Static CommonJS names under the served module's source identity.
 *
 * Every re-export resolves through that source's CommonJS require authority,
 * including package conditions. The reader supplies JavaScript bytes or the
 * target TypeScript source's own compiler emit; private output paths never
 * become resolution origins. Targets are not evaluated. Failed resolution adds
 * no names and leaves the eventual native load to report its error, whereas a
 * reader's ownership error propagates. Root default metadata is retained for
 * the facade's native own-property ordering; nested default is not re-exported.
 *
 * @evidence contracts/common.md#principled-implementation Node createRequire resolves each edge from the physical source module using require conditions; the runtime supplies its existing source-rescue resolver on supported hook variants. Owned compiler bytes retain TypeScript elision and lowering. Static parsing discovers possible names, while the original loaded helper and facade own values and property semantics.
 * @evidence contracts/common.md#clear-and-simple-design One traversal serves both JavaScript and TypeScript facades. A call-scoped physical seen set prevents mixed-source cycles and duplicate reads without separate emitted/source resolution policies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native package resolution and the runtime's existing relative-source policy decide targets. No package-specific exception, foreign loader replacement or target evaluation supplies names.
 * @evidence contracts/common.md#meaningful-documentation Native prose states source-origin and owned-reader authority, unresolved versus reader failure, static-only discovery and direct versus nested default semantics.
 * @evidence contracts/portability.md#os-neutral-implementation Node native require/path resolution and realPath preserve actual filesystem identity, package maps and platform paths without separator rewriting or OS-based casing assumptions.
 * @evidence contracts/performance.md#efficient-algorithms Each reachable physical target is read and parsed at most once per scan; edges incur native resolution and set insertion. Source bytes, metadata, names and a DFS stack scale with the reachable graph; no configured graph/depth cap bounds parser or reader work.
 * @evidence contracts/performance.md#reuse-equivalent-work The traversal shares equivalent physical targets within one scan. Compiler-owned emission reuse belongs to the supplied reader; mutable package resolution and source results are not cached across scans here.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Names and visited identities are call-local; only the returned array escapes. The reader and native resolver own their synchronous resources and compiler lifetimes; this scanner retains no historical graph or native handle.
 */
export function commonJsExportNames(
  source: string,
  filename: string,
  readSource: (file: string) => string | null,
  resolve: (parent: string, specifier: string) => string = (parent, specifier) =>
    createRequire(parent).resolve(specifier),
): string[] {
  const names = new Set<string>();
  const seen = new Set<string>();
  const visit = (file: string, text: string, root: boolean): void => {
    const real = realPath(file);
    if (seen.has(real)) return;
    seen.add(real);
    const parsed = parseCommonJsExports(text);
    for (const name of parsed.exports)
      if (root || name !== "default") names.add(name);
    for (const specifier of parsed.reexports) {
      let target: string;
      try { target = resolve(real, specifier); } catch { continue; }
      if (!path.isAbsolute(target)) continue;
      if ([".json", ".node", ".mjs"].includes(path.extname(target))) continue;
      const physical = realPath(target);
      if (seen.has(physical)) continue;
      const nested = readSource(physical);
      if (nested === null) seen.add(physical);
      else visit(physical, nested, false);
    }
  };
  visit(filename, source, true);
  return [...names];
}
