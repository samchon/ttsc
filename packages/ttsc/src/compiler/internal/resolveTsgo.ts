import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Resolve the consumer project's TypeScript-Go preview binary and metadata.
 *
 * Resolution order:
 *
 * 1. `opts.binary` or `TTSC_TSGO_BINARY` env var — must be an existing absolute
 *    path; returns `{ binary, packageJson: "", packageRoot, version: "custom"
 *    }`.
 * 2. `@typescript/native-preview` resolved from the project `cwd`.
 * 3. `@typescript/native-preview` resolved from `opts.resolveFrom` (for test
 *    harnesses and embedders that anchor to a different directory).
 *
 * Throws a descriptive error when the package or platform binary is missing so
 * callers never have to reason about undefined binary paths.
 */
export function resolveTsgo(
  opts: {
    /** Explicit path to a tsgo binary; bypasses package resolution. */
    binary?: string;
    /** Directory from which to discover `@typescript/native-preview`. */
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    /**
     * Fallback resolution anchor used when the package is not found at `cwd`.
     * Useful in test harnesses that install the package into a different tree.
     */
    resolveFrom?: string;
  } = {},
) {
  const env = opts.env ?? process.env;
  const explicit = opts.binary ?? env.TTSC_TSGO_BINARY;
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
  // Resolve the package.json of @typescript/native-preview.
  // Try cwd first, then the optional resolveFrom anchor.
  let packageJson: string;
  packageJson =
    resolveNativePreviewPackageJson(path.join(cwd, "package.json")) ??
    (opts.resolveFrom
      ? resolveNativePreviewPackageJson(opts.resolveFrom)
      : undefined) ??
    "";
  if (!packageJson) {
    throw new Error(
      [
        "ttsc: @typescript/native-preview is required.",
        "Install the TypeScript-Go preview in the consuming project:",
        "  npm i -D @typescript/native-preview",
      ].join("\n"),
    );
  }

  const manifest = readPackageJson(packageJson);
  const packageRoot = path.dirname(packageJson);
  const platformPackage = `@typescript/native-preview-${process.platform}-${process.arch}`;
  const platformResolver = createRequire(packageJson);
  let platformPackageJson: string;
  try {
    platformPackageJson = platformResolver.resolve(
      `${platformPackage}/package.json`,
    );
  } catch {
    throw new Error(
      [
        `ttsc: platform-specific TypeScript-Go binary not found (${platformPackage}).`,
        "Reinstall @typescript/native-preview with optional dependencies enabled.",
      ].join("\n"),
    );
  }

  const platformRoot = path.dirname(platformPackageJson);
  const binary = path.join(
    platformRoot,
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
  if (!fs.existsSync(binary)) {
    throw new Error(`ttsc: TypeScript-Go executable not found: ${binary}`);
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

/**
 * Attempt to resolve the `package.json` of `@typescript/native-preview`
 * starting from `from` (a package.json path or directory). Returns `undefined`
 * when the package is not resolvable from that location.
 */
function resolveNativePreviewPackageJson(from: string): string | undefined {
  try {
    return createRequire(from).resolve(
      "@typescript/native-preview/package.json",
    );
  } catch {
    return undefined;
  }
}

/** Parse a JSON file and return the result as a plain object. */
function readPackageJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}
