import fs from "node:fs";
import path from "node:path";

/**
 * Resolve the platform-specific ttscserver binary path. Looks first at the
 * TTSCSERVER_BINARY environment override (must be absolute), then at the
 * shipped per-platform npm package (`@ttsc/<platform>-<arch>/bin/ttscserver`),
 * then at the local-build fallback under `packages/native/`.
 *
 * Mirrors `resolveBinary` for the ttsc helper so editors that install ttsc via
 * pnpm see the LSP host alongside the existing helper.
 */
export function resolveTtscserverBinary(
  opts: { env?: NodeJS.ProcessEnv } = {},
): string | null {
  const env = opts.env ?? process.env;
  if (env.TTSCSERVER_BINARY && path.isAbsolute(env.TTSCSERVER_BINARY)) {
    return env.TTSCSERVER_BINARY;
  }

  try {
    return require.resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/${
        process.platform === "win32" ? "ttscserver.exe" : "ttscserver"
      }`,
    );
  } catch {
    /* fall through to local lookup */
  }

  const local = defaultLocalBinaryPath();
  if (local) return local;

  return null;
}

function defaultLocalBinaryPath(): string | null {
  const root = packageRootDir();
  const candidate = path.resolve(
    root,
    "..",
    "native",
    process.platform === "win32" ? "ttscserver.exe" : "ttscserver",
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function packageRootDir(): string {
  const moduleDir = path.resolve(__dirname, "..", "..");
  // Prefer the faster native variant; fall back to the JS implementation on
  // platforms (or environments) where `realpathSync.native` is unavailable.
  return fs.realpathSync.native?.(moduleDir) ?? fs.realpathSync(moduleDir);
}
