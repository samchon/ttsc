import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * The ttsc and TypeScript-Go versions a transform runs under, which a plugin
 * build keys every binary on (`computeCacheKey`) and which the native host is
 * built from as well.
 *
 * What a transform produces is a function of its inputs, its plugins' sources
 * (`pluginSourceDigest`), and these versions. A consumer that keeps a
 * transform's output beyond the process that produced it, as a persisted shared
 * compile of `@ttsc/unplugin` is (samchon/ttsc#1483), names it by these
 * versions with the rule the build applies instead of a copy of it: ttsc's own
 * package version, and the version of the `typescript` package the project
 * resolves, or `"unknown"` when it resolves none.
 *
 * @param projectRoot The project the transform runs for, which resolves its
 *   TypeScript-Go.
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
