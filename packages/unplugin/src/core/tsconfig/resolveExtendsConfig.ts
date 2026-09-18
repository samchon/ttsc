import { createRequire } from "node:module";
import path from "node:path";

import { isRelativeSpecifier } from "./isRelativeSpecifier";
import { resolveExistingExtendsPath } from "./resolveExistingExtendsPath";
import { resolvePackageManifestTsconfig } from "./resolvePackageManifestTsconfig";
import { resolveRealPath } from "./resolveRealPath";

/**
 * Resolve an `extends` specifier to an absolute config path using TypeScript's
 * rules: absolute paths and relative specifiers get an exact-file / `.json`
 * fallback; bare specifiers go through Node's module resolver scoped to the
 * declaring config. Returns `null` instead of throwing; the compiler reports
 * unresolvable `extends` itself.
 */
export function resolveExtendsConfig(
  tsconfig: string,
  specifier: string,
): string | null {
  if (path.isAbsolute(specifier)) {
    return resolveExistingExtendsPath(specifier);
  }
  if (isRelativeSpecifier(specifier)) {
    return resolveExistingExtendsPath(
      path.resolve(path.dirname(tsconfig), specifier),
    );
  }
  const resolver = createRequire(tsconfig);
  // A bare package root selects its preset through `package.json#tsconfig`,
  // matching TypeScript's config resolution and the core project reader. Such
  // presets often ship no JS/JSON entrypoint, so Node's entrypoint resolver and
  // the `<specifier>.json` fallback both miss them, silently dropping the
  // preset's inherited `paths`.
  const viaManifest = resolvePackageManifestTsconfig(resolver, specifier);
  if (viaManifest !== null) {
    return viaManifest;
  }
  try {
    return resolveRealPath(resolver.resolve(specifier));
  } catch {
    try {
      return resolveRealPath(resolver.resolve(`${specifier}.json`));
    } catch {
      return null;
    }
  }
}
