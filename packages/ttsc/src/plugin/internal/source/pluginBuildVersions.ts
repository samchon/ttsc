import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * The ttsc and TypeScript-Go versions a transform runs under, which a plugin
 * build keys every binary on (`computeCacheKey`) and which the native host is
 * built from as well.
 *
 * What a transform produces is a function of its inputs, its plugins' sources
 * and build environment (`pluginSourceState`), and these versions. A consumer
 * that keeps a transform's output beyond the process that produced it, as a
 * persisted shared compile of `@ttsc/unplugin` is (samchon/ttsc#1483), names it
 * by these versions with the rule the build applies instead of a copy of it:
 * ttsc's own package version, and the version of the `typescript` package the
 * project resolves, or `"unknown"` when it resolves none.
 *
 * @param projectRoot The project the transform runs for, which resolves its
 *   TypeScript-Go.
 *
 * @evidence contracts/common.md#principled-implementation Package versions identify the host and project-resolved compiler in the same format used by plugin keys; absent metadata receives the documented unknown/default identity rather than a guessed release.
 * @evidence contracts/common.md#clear-and-simple-design Host-version and project-version readers are separate because one installation is stable within the process while project resolution varies per call.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Node package resolution determines the actual project dependency; no particular project or fixture version is embedded.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains persisted-output consumers and the unknown project-version meaning, with separated tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node createRequire and path APIs locate package metadata using native module resolution without manual separator or case normalization.
 * @evidence contracts/performance.md#efficient-algorithms A call resolves and reads one small project package manifest; the fixed host manifest is read only on the first invocation.
 * @evidence contracts/performance.md#reuse-equivalent-work All callers share the host installation's process-stable version; the project compiler version is resolved afresh so different project roots do not share a false identity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The only retained state is one host-version string, bounded independently of the number of projects; file reads leave no persistent descriptors.
 */
export function pluginBuildVersions(projectRoot: string): {
  tsgo: string;
  ttsc: string;
} {
  return { tsgo: readTsgoVersion(projectRoot), ttsc: readTtscVersion() };
}

let cachedTtscVersion: string | null = null;

function readTtscVersion(): string {
  if (cachedTtscVersion !== null) return cachedTtscVersion;
  try {
    const file = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "package.json",
    );
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      version?: string;
    };
    cachedTtscVersion = pkg.version ?? "0.0.0";
  } catch {
    cachedTtscVersion = "0.0.0";
  }
  return cachedTtscVersion;
}

function readTsgoVersion(projectRoot: string): string {
  try {
    const projectRequire = createRequire(
      path.join(projectRoot, "package.json"),
    );
    const pkgPath = projectRequire.resolve("typescript/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
