import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Package-version labels used by plugin build keys (`computeCacheKey`) and
 * persisted transform identities. These are metadata inputs, not a measurement
 * of the executable actually selected for an invocation.
 *
 * Transform reuse also depends on inputs, plugin sources, build environment
 * and the producer's declared proofs; these labels alone certify none of them. A consumer
 * that keeps a transform's output beyond the process that produced it, as a
 * persisted shared compile of `@ttsc/unplugin` is, names it
 * by these versions with the rule the build applies instead of a copy of it:
 * ttsc's own package version, and the version of the `typescript` package the
 * project resolves, or `"unknown"` when resolution/read/parse fails or its
 * version is absent. The host label falls back to `"0.0.0"` and is cached even
 * after an unsuccessful first read. The host installation is assumed stable
 * for the process lifetime; changing its manifest does not refresh that label.
 *
 * @param projectRoot The project base used to resolve `typescript/package.json`.
 *
 * @evidence contracts/common.md#principled-implementation Package-version labels supply the same metadata tuple used by plugin keys; absent/unreadable metadata receives the documented unknown/default label rather than an executable identity certificate.
 * @evidence contracts/common.md#clear-and-simple-design Host-version and project-version readers are separate because one installation is stable within the process while project resolution varies per call.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Node package resolution determines the actual project dependency; no particular project or fixture version is embedded.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains persisted-output consumers, metadata fallbacks and the process-stable host premise without claiming that version labels establish executable or output equivalence.
 * @evidence contracts/portability.md#os-neutral-implementation Node createRequire and path APIs locate package metadata using native module resolution without manual separator or case normalization.
 * @evidence contracts/performance.md#efficient-algorithms Each call performs project package resolution and, when successful, reads/parses its manifest bytes; module search/path work and metadata size are not fixed by one logical manifest lookup. The host manifest is attempted only on the first invocation, including native path and JSON costs.
 * @evidence contracts/performance.md#reuse-equivalent-work All callers share the host installation's process-stable version; the project compiler version is resolved afresh so different project roots do not share a false identity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This helper retains one host-version label for the process lifetime, whose text follows its manifest value rather than a fixed byte limit; the helper's retained label count is independent of project count. Native module-resolution caches belong to Node, and synchronous file reads leave no persistent descriptor here.
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
