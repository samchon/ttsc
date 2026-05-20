import fs from "node:fs";
import path from "node:path";

/**
 * Resolve the ttsc helper binary path, or null when unavailable.
 *
 * Resolution order:
 *
 * 1. `TTSC_BINARY` env var — must be an absolute path when set.
 * 2. The per-platform npm package `@ttsc/<platform>-<arch>/bin/ttsc[.exe]`.
 * 3. A `ttsc-native[.exe]` sibling of this package's root (dev/CI layout).
 */
export function resolveBinary(
  opts: { env?: NodeJS.ProcessEnv } = {},
): string | null {
  const env = opts.env ?? process.env;
  if (env.TTSC_BINARY && path.isAbsolute(env.TTSC_BINARY)) {
    return env.TTSC_BINARY;
  }

  try {
    return require.resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/${process.platform === "win32" ? "ttsc.exe" : "ttsc"}`,
    );
  } catch {
    /* fall through */
  }

  const local = defaultLocalBinaryPath();
  if (local) return local;

  return null;
}

/**
 * Return the path to the dev-layout `ttsc-native[.exe]` binary adjacent to the
 * package root, or null when the file does not exist.
 */
function defaultLocalBinaryPath(): string | null {
  const root = packageRootDir();
  const candidate = path.resolve(
    root,
    "..",
    "native",
    process.platform === "win32" ? "ttsc-native.exe" : "ttsc-native",
  );
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Return the real, absolute path of the `packages/ttsc` package root by walking
 * two levels up from `__dirname` (which lives in `src/compiler/internal`).
 */
function packageRootDir(): string {
  const moduleDir = path.resolve(__dirname, "..", "..");
  return fs.realpathSync.native?.(moduleDir) ?? fs.realpathSync(moduleDir);
}
