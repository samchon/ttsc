import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";

/**
 * Resolve the ttsc helper binary path, or null when unavailable.
 *
 * Resolution order:
 *
 * 1. `TTSC_BINARY` env var — must be an absolute path when set.
 * 2. The per-platform npm package `@ttsc/<platform>-<arch>/bin/ttsc[.exe]`.
 * 3. `native/ttsc-native[.exe]` inside this package (local Go build layout).
 *
 * A relative TTSC_BINARY is ignored; an absolute override is returned without a
 * filesystem probe so the spawn operation owns its executable error.
 *
 * @evidence contracts/common.md#principled-implementation Explicit absolute authority precedes Node's platform-package resolution and then the package-local Go build output, matching the helper binary ownership exported through ttsc/binary.
 * @evidence contracts/common.md#clear-and-simple-design A single resolver owns precedence for compiler and external helper consumers; the local-path helper separates source/lib layout from installed platform-package lookup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Platform package names and executable suffixes follow the published package contract; the resolver uses supported require.resolve without replacing foreign resolution methods.
 * @evidence contracts/common.md#meaningful-documentation Ordered resolution and override behavior are documented separately; the corrected development path matches go:build, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Platform and architecture select the native package and executable suffix; native path APIs establish the development path, and override lookup follows Windows environment-name identity even in a caller's ordinary object.
 * @evidence contracts/performance.md#efficient-algorithms The resolver follows a fixed number of precedence branches; npm lookup cost belongs to Node module resolution, followed by at most one local existence check.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Environment overrides and development binaries may change between calls; the resolver owns no invalidation protocol beyond Node's own module resolver and introduces no stale path cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resolution owns no persistent map, descriptor or task and returns only the selected path spelling.
 */
export function resolveBinary(
  opts: { env?: NodeJS.ProcessEnv } = {},
): string | null {
  const env = opts.env ?? process.env;
  const explicit = SidecarEnvironment.read(env, "TTSC_BINARY");
  if (explicit && path.isAbsolute(explicit)) {
    return explicit;
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

/** Return the package-local Go build output, or null when it does not exist. */
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
 * Return the physical src or lib directory above this compiler module. The
 * local build output is in the sibling native directory of that tree.
 */
function packageRootDir(): string {
  const moduleDir = path.resolve(__dirname, "..", "..");
  return fs.realpathSync.native?.(moduleDir) ?? fs.realpathSync(moduleDir);
}
