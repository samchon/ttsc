import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Resolve the platform-specific ttscserver binary path. Looks first at the
 * TTSCSERVER_BINARY environment override (must be absolute), then at the
 * shipped per-platform npm package (`@ttsc/<platform>-<arch>/bin/ttscserver`),
 * then at the local-build fallback under this package's `native/` directory.
 *
 * Mirrors `resolveBinary` for the ttsc helper so editors that install ttsc via
 * pnpm see the LSP host alongside the existing helper.
 *
 * @evidence contracts/common.md#principled-implementation An absolute caller override precedes the host platform/architecture package and then the real package-relative development binary, preserving deployment precedence.
 * @evidence contracts/common.md#clear-and-simple-design Executable discovery returns a path or absence; helpers isolate package-root resolution and the local-build candidate without starting the server.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The local fallback addresses an actual source-checkout layout, and .exe is a native executable naming distinction rather than a consumer exception.
 * @evidence contracts/common.md#meaningful-documentation Native prose states search order, override requirements and local-development fallback; absence remains explicit in the return type.
 * @evidence contracts/portability.md#os-neutral-implementation Node's host platform/architecture select the shipped executable; shared environment lookup follows Windows name aliases while POSIX names stay exact. Native path/realpath operations anchor local lookup without inferring filesystem case policy from an OS name.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources resolveTtscserverBinary declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms resolveTtscserverBinary declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work resolveTtscserverBinary declares a signature only; the implementation owns any shared work.
 */
export function resolveTtscserverBinary(
  opts: { env?: NodeJS.ProcessEnv } = {},
): string | null {
  const env = opts.env ?? process.env;
  const explicit = SidecarEnvironment.read(env, "TTSCSERVER_BINARY");
  if (explicit && path.isAbsolute(explicit)) {
    return explicit;
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
