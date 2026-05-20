import fs from "node:fs";
import path from "node:path";

import { buildSourcePlugin } from "../../plugin/internal/buildSourcePlugin";

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
 */
export function buildNativeCompiler(options: {
  cacheBaseDir: string;
  cacheDir?: string;
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
