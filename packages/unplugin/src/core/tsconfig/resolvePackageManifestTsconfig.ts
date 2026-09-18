import fs from "node:fs";
import path from "node:path";

import { isBarePackageRoot } from "./isBarePackageRoot";
import { normalizeTypeScriptPathSeparators } from "./normalizeTypeScriptPathSeparators";
import { resolveExistingExtendsPath } from "./resolveExistingExtendsPath";

/**
 * When `specifier` names a bare package root, resolve the config file its
 * `package.json#tsconfig` field selects (anchored at the package directory).
 * Best-effort: returns `null` for a subpath, an unresolvable/unparsable
 * manifest, a missing `tsconfig` field, or a field target that does not exist —
 * the compiler owns the real diagnostic, and this reader must not invent
 * aliases.
 */
export function resolvePackageManifestTsconfig(
  resolver: NodeRequire,
  specifier: string,
): string | null {
  if (!isBarePackageRoot(specifier)) {
    return null;
  }
  let manifestPath: string;
  try {
    manifestPath = resolver.resolve(`${specifier}/package.json`);
  } catch {
    return null;
  }
  let field: unknown;
  try {
    const text = fs.readFileSync(manifestPath, "utf8");
    field = (
      JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as {
        tsconfig?: unknown;
      }
    ).tsconfig;
  } catch {
    return null;
  }
  if (typeof field !== "string" || field.length === 0) {
    return null;
  }
  return resolveExistingExtendsPath(
    path.resolve(
      path.dirname(manifestPath),
      normalizeTypeScriptPathSeparators(field),
    ),
  );
}
