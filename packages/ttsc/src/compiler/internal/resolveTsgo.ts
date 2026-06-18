import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Resolve the consumer project's native TypeScript (`tsc`) binary and metadata.
 *
 * Resolution order:
 *
 * 1. `opts.binary` or `TTSC_TSGO_BINARY` env var — must be an existing absolute
 *    path; returns `{ binary, packageJson: "", packageRoot, version: "custom"
 *    }`.
 * 2. `typescript` resolved from the project `cwd`.
 * 3. `typescript` resolved from `opts.resolveFrom` (for test harnesses and
 *    embedders that anchor to a different directory).
 *
 * Throws a descriptive error when the package or platform binary is missing so
 * callers never have to reason about undefined binary paths.
 */
export function resolveTsgo(
  opts: {
    /** Explicit path to a native `tsc` binary; bypasses package resolution. */
    binary?: string;
    /** Directory from which to discover `typescript`. */
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
  // Resolve the package.json of typescript.
  // Try cwd first, then the optional resolveFrom anchor.
  let packageJson: string;
  packageJson =
    resolveTypeScriptPackageJson(path.join(cwd, "package.json")) ??
    (opts.resolveFrom
      ? resolveTypeScriptPackageJson(opts.resolveFrom)
      : undefined) ??
    "";
  if (!packageJson) {
    throw new Error(
      [
        "ttsc: typescript is required.",
        "Install the native TypeScript compiler in the consuming project:",
        "  npm i -D typescript",
      ].join("\n"),
    );
  }

  const manifest = readPackageJson(packageJson);
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
        "Reinstall typescript with optional dependencies enabled.",
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

/**
 * Attempt to resolve the `package.json` of `typescript` starting from `from` (a
 * package.json path or directory). Returns `undefined` when the package is not
 * resolvable from that location.
 */
function resolveTypeScriptPackageJson(from: string): string | undefined {
  try {
    return createRequire(from).resolve("typescript/package.json");
  } catch {
    return undefined;
  }
}

/** Parse a JSON file and return the result as a plain object. */
function readPackageJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}
