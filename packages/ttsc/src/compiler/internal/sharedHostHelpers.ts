import fs from "node:fs";
import path from "node:path";

import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";

/**
 * Names of the first-party utility transform plugins that are allowed to share
 * one compiler emit / one source-to-source pass even when their resolved
 * binaries differ. Each entry must be both name-pinned and manifest-pinned: the
 * plugin must declare itself with one of these names AND its source path must
 * resolve to a `package.json` whose `name` field matches.
 *
 * This whitelist exists because `@ttsc/banner`, `@ttsc/paths`, and
 * `@ttsc/strip` are AST-only mutators that operate on the same
 * `*shimast.SourceFile` graph and do not own emit. They are composed through
 * `packages/ttsc/utility/host.go`, so any one of their binaries can host the
 * shared run. Third-party plugins cannot participate in this fast path; they
 * must opt into composition through the explicit `ITtscPlugin.composes` field.
 */
export const FIRST_PARTY_UTILITY_PLUGIN_NAMES: ReadonlySet<string> = new Set([
  "@ttsc/banner",
  "@ttsc/paths",
  "@ttsc/strip",
]);

/**
 * Reports whether the given plugin is a first-party utility transform plugin
 * that may participate in the shared compiler host alongside other first-party
 * utility transforms. Returns `false` for `check`-stage plugins, for unknown
 * names, and for plugins whose `source` does not resolve to a matching
 * `package.json`.
 */
export function isFirstPartyUtilityTransformPlugin(
  plugin: ITtscLoadedNativePlugin,
): boolean {
  if (plugin.stage !== "transform") return false;
  if (!FIRST_PARTY_UTILITY_PLUGIN_NAMES.has(plugin.name)) return false;
  const manifest = readNearestPackageManifest(plugin.source);
  return manifest?.name === plugin.name;
}

/**
 * Walks upward from `source` (a directory or file path) up to four parent
 * levels searching for the nearest `package.json`. Returns the parsed manifest
 * object on success, or `undefined` when no manifest is found or parsing fails.
 * The depth bound mirrors the pre-existing inline implementations in
 * `runBuild.ts` and `transformProjectInMemory.ts`.
 */
export function readNearestPackageManifest(
  source: string,
): { name?: unknown } | undefined {
  try {
    let current = fs.statSync(source).isDirectory()
      ? source
      : path.dirname(source);
    for (let i = 0; i < 4; i += 1) {
      const manifest = path.join(current, "package.json");
      if (fs.existsSync(manifest)) {
        return JSON.parse(fs.readFileSync(manifest, "utf8")) as {
          name?: unknown;
        };
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Verifies that all transform plugins in `plugins` either resolve to the same
 * native binary (the common case) or are all first-party utility plugins (the
 * shared compiler-host fast path).
 *
 * Two callers exist with subtly different error wording: the build path
 * (`runBuild.ts`) reports "multiple compiler native backends cannot share one
 * emit pass" while the source-to-source path (`transformProjectInMemory.ts`)
 * reports "cannot share one source-to-source pass". The `pass` argument selects
 * the appropriate phrase so the error message remains diagnostic-grade instead
 * of generic.
 */
export function assertSharedHostCompatibility(
  plugins: readonly ITtscLoadedNativePlugin[],
  pass: "emit" | "source-to-source",
): void {
  const binaries = [...new Set(plugins.map((plugin) => plugin.binary))];
  if (binaries.length <= 1) {
    return;
  }
  if (plugins.every(isFirstPartyUtilityTransformPlugin)) {
    return;
  }
  const phrase =
    pass === "emit"
      ? "multiple compiler native backends cannot share one emit pass"
      : "multiple transform native backends cannot share one source-to-source pass";
  throw new Error(
    "ttsc: " +
      phrase +
      "; compose transform libraries through one aggregate native host",
  );
}
