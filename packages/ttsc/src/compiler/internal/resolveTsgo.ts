import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { resolveNativeTypeScriptPackage } from "./resolveNativeTypeScriptPackage";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";

/**
 * Resolve the consumer project's native TypeScript (`tsc`) binary and metadata.
 *
 * Resolution order:
 *
 * 1. Select `opts.binary`, or consult `TTSC_TSGO_BINARY` only when it is absent. A
 *    nonempty override must be an existing absolute path; returns `{ binary,
 *    packageJson: "", packageRoot, version: "custom" }`.
 * 2. Declared npm aliases targeting TypeScript, then native `typescript`, from
 *    `cwd`.
 * 3. The same discovery from `opts.resolveFrom` (for test harnesses and embedders
 *    that anchor to a different directory).
 *
 * Throws a descriptive error when the package or platform path is missing.
 * Manifest read/parse failures can propagate directly. Existence does not
 * certify a regular executable, native ABI or compiler-target compatibility;
 * this operation selects paths and metadata without executing them. Platform
 * package resolution is anchored at the chosen TypeScript manifest and can
 * follow Node's ancestor search, rather than proving both packages occupy one
 * physical installation or declare matching versions.
 *
 * @evidence contracts/common.md#principled-implementation Selected nonempty binary authority precedes project-relative TypeScript lookup; the chosen manifest anchors Node resolution of the platform package. Returned metadata describes the selected TypeScript manifest, without certifying native executable compatibility or matching platform-package versions.
 * @evidence contracts/common.md#clear-and-simple-design Resolution returns one existing selected path with provenance metadata; package lookup and JSON reading are private helpers rather than independent policy copies in launcher consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Package names and lib/tsc suffixes follow the native TypeScript distribution contract. Missing dependencies remain descriptive errors rather than invented compiler paths or fixture-specific substitutes.
 * @evidence contracts/common.md#meaningful-documentation Ordered precedence, custom metadata and failures are documented separately, and the fallback anchor member explains its filename semantics following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path APIs validate absolute overrides and select the Windows executable suffix; createRequire anchors resolution to actual package files without shell quoting or OS-derived case policy.
 * @evidence contracts/performance.md#efficient-algorithms Up to two anchors delegate ancestor manifest and alias discovery before one platform lookup. Dependency declaration counts, alias lookups, manifest bytes and path work determine cost; Windows environment selection scans environment keys through SidecarEnvironment. Returned metadata does not retain parsed manifests.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Overrides and consumer installations are mutable filesystem authority; this resolver owns no dependency invalidation source that could justify retaining a custom result across calls.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous package reads retain no handles or tasks; returned path and version strings transfer to the caller without a historical metadata table.
 */
export function resolveTsgo(
  opts: {
    /** Explicit path to a native `tsc` binary; bypasses package resolution. */
    binary?: string;

    /** Directory from which to discover native TypeScript. */
    cwd?: string;

    /**
     * Complete environment for executable selection; omission reads the current
     * process environment. Public compiler owners merge caller overrides before
     * invoking this resolver, retaining their original overlay for channel
     * ownership.
     */
    env?: NodeJS.ProcessEnv;

    /**
     * Absolute filename used to anchor fallback resolution when the package is
     * absent at cwd. Pass a package.json or module filename, not a directory.
     */
    resolveFrom?: string;
  } = {},
) {
  const env = opts.env ?? process.env;
  const explicit =
    opts.binary ?? SidecarEnvironment.read(env, "TTSC_TSGO_BINARY");
  if (explicit) {
    if (!path.isAbsolute(explicit) || !fs.existsSync(explicit)) {
      throw new Error(
        `ttsc: explicit tsgo binary must be an existing absolute path: ${explicit}`,
      );
    }
    return {
      binary: explicit,
      packageJson: "",
      packageRoot: path.dirname(explicit),
      version: "custom",
    };
  }

  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const selected =
    resolveNativeTypeScriptPackage(path.join(cwd, "package.json")) ??
    (opts.resolveFrom
      ? resolveNativeTypeScriptPackage(opts.resolveFrom)
      : undefined);
  if (!selected) {
    throw new Error(
      [
        "ttsc: native TypeScript 7 or newer is required.",
        "Install the native TypeScript compiler in the consuming project:",
        "  npm i -D typescript",
        "For legacy tooling, declare an npm:typescript@^7 alias in package.json.",
      ].join("\n"),
    );
  }

  const { packageJson, manifest } = selected;
  const packageRoot = path.dirname(packageJson);
  const platformPackage = `@typescript/typescript-${process.platform}-${process.arch}`;
  const platformResolver = createRequire(packageJson);
  let platformPackageJson: string;
  try {
    platformPackageJson = platformResolver.resolve(
      `${platformPackage}/package.json`,
    );
  } catch {
    throw new Error(
      [
        `ttsc: platform-specific TypeScript binary not found (${platformPackage}).`,
        "Reinstall the selected native TypeScript package with optional dependencies enabled.",
      ].join("\n"),
    );
  }

  const platformRoot = path.dirname(platformPackageJson);
  const binary = path.join(
    platformRoot,
    "lib",
    process.platform === "win32" ? "tsc.exe" : "tsc",
  );
  if (!fs.existsSync(binary)) {
    throw new Error(`ttsc: TypeScript executable not found: ${binary}`);
  }
  return {
    binary,
    gitHead:
      typeof manifest.gitHead === "string" ? manifest.gitHead : undefined,
    packageJson,
    packageRoot,
    platformPackageJson,
    version:
      typeof manifest.version === "string" ? manifest.version : "unknown",
  };
}
