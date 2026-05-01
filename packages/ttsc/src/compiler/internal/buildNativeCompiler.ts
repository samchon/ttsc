import * as fs from "node:fs";
import * as path from "node:path";

import { buildSourcePlugin } from "../../plugin/internal/buildSourcePlugin";

/** Build the native ttsc compiler host used by in-memory API compilation. */
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

function readGoModuleVersion(packageRoot: string): string {
  try {
    const goMod = fs.readFileSync(path.join(packageRoot, "go.mod"), "utf8");
    return goMod;
  } catch {
    return "unknown";
  }
}
