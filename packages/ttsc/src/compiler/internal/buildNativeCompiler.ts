import fs from "node:fs";
import path from "node:path";

import { buildSourcePlugin } from "../../plugin/internal/source/buildSourcePlugin";

/**
 * Build (or retrieve from cache) the native ttsc compiler host binary used by
 * the in-memory API compilation paths (`compileProjectInMemory`,
 * `transformProjectInMemory`).
 *
 * The host is the `cmd/ttsc` Go entrypoint compiled with `buildSourcePlugin`.
 * The cache key incorporates the ttsc package version and the full `go.mod`
 * contents so a toolchain upgrade automatically produces a fresh binary.
 *
 * @returns Absolute path to the compiled host executable.
 *
 * @evidence contracts/common.md#principled-implementation The compiler host is the package's cmd/ttsc Go source built by the same source-plugin artifact owner; package version and full module text supplement that owner's source and environment identity.
 * @evidence contracts/common.md#clear-and-simple-design This adapter supplies the host source, cache anchor and version tokens while buildSourcePlugin owns compilation, locking and artifact admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Version read fallbacks label unavailable metadata; they do not replace the owning builder's actual source/environment proof or synthesize a binary path.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the compiler consumers and version-token inputs; separated option members distinguish project cache base, optional override and package source root.
 * @evidence contracts/performance.md#efficient-algorithms The adapter reads package metadata and module text once before delegating dominant source fingerprinting and Go compilation to the artifact builder.
 * @evidence contracts/performance.md#reuse-equivalent-work buildSourcePlugin shares the compiled host only under its validated source/toolchain identity; this adapter adds package/module coordinates rather than trusting a version label alone.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The artifact builder owns lock, process and persistent cache lifetimes; this adapter returns the resulting path without acquiring an independent handle or history.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Node path joining selects the package source directory and the owning builder selects native executable/toolchain behavior; no shell command or fixed platform executable name is constructed here.
 */
export function buildNativeCompiler(options: {
  /** Project anchor used by the owning source-plugin cache resolver. */
  cacheBaseDir: string;

  /** Optional explicit cache directory, interpreted by the artifact builder. */
  cacheDir?: string;

  /** Installed ttsc package containing cmd/ttsc and its module metadata. */
  packageRoot: string;
}): string {
  return buildSourcePlugin({
    baseDir: options.cacheBaseDir,
    cacheDir: options.cacheDir,
    label: "compiler host",
    overlayDirs: [],
    pluginName: "ttsc",
    quiet: true,
    source: path.join(options.packageRoot, "cmd", "ttsc"),
    ttscVersion: readOwnPackageVersion(options.packageRoot),
    tsgoVersion: readGoModuleVersion(options.packageRoot),
  });
}

/**
 * Read the `version` field from `package.json` inside `packageRoot`, falling
 * back to `"0.0.0"` when the file is absent or malformed.
 */
function readOwnPackageVersion(packageRoot: string): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    ) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Read the full contents of `go.mod` inside `packageRoot` and use it as a
 * version token for the binary cache key. Returns `"unknown"` on read error.
 *
 * Using the entire `go.mod` ensures that any dependency bump (including
 * indirect ones) invalidates the cached binary.
 */
function readGoModuleVersion(packageRoot: string): string {
  try {
    return fs.readFileSync(path.join(packageRoot, "go.mod"), "utf8");
  } catch {
    return "unknown";
  }
}
