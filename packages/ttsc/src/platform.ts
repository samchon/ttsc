/**
 * Platform detection and helper-binary resolution for ttsc.
 *
 * This is the tested implementation used by the ttsc launcher after build.
 * Keep it pure and dependency-free so it can be unit-tested without spawning
 * any child process.
 *
 * The platform packages now ship a small compatibility helper, not the
 * TypeScript-Go compiler. Compiler calls resolve the consuming project's
 * `@typescript/native-preview` through `tsgo.ts`.
 *
 * Helper resolution order:
 *
 *   1. `TTSC_BINARY` environment variable (absolute path). Highest priority —
 *      lets local devs or CI point at an ad-hoc build without touching
 *      node_modules.
 *   2. `@ttsc/{platform}-{arch}/bin/ttsc{.exe}` optional dependency.
 *      Standard distribution path for compatibility helper commands.
 *   3. A package-local `native/ttsc-native` helper. Used by this
 *      repository's local `pnpm run build` output before the
 *      platform packages exist on npm.
 *
 * If every strategy fails, `resolveBinary` returns `null` so the caller can print a
 * detailed install hint.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { ITtscResolveOptions } from "./structures/ITtscResolveOptions";

export type { ITtscResolveOptions } from "./structures/ITtscResolveOptions";

/** Canonical key `{platform}-{arch}` used in the binary package name. */
export function platformKey(opts: ITtscResolveOptions = {}): string {
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  return `${platform}-${arch}`;
}

/** Helper binary filename for the current platform (`.exe` on Windows, else none). */
export function binaryName(opts: ITtscResolveOptions = {}): string {
  const platform = opts.platform ?? process.platform;
  return platform === "win32" ? "ttsc.exe" : "ttsc";
}

/**
 * Resolve the optional-dependency module request string for the current
 * platform. Separated from actual resolution so we can log the request when
 * the dependency is missing.
 */
export function platformPackageRequest(opts: ITtscResolveOptions = {}): string {
  const key = platformKey(opts);
  const bin = binaryName(opts);
  return `@ttsc/${key}/bin/${bin}`;
}

/** The list of platform keys the package currently ships. */
export const SUPPORTED_PLATFORMS: readonly string[] = Object.freeze([
  "linux-x64",
  "linux-arm",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
  "win32-x64",
  "win32-arm64",
]);

/** True if the given platform key is in the supported list. */
export function isSupported(key: string): boolean {
  return SUPPORTED_PLATFORMS.includes(key);
}

/**
 * Resolve an absolute path to the ttsc helper using the documented priority
 * order. Returns `null` when every strategy fails — the launcher then prints
 * the install hint and exits non-zero.
 */
export function resolveBinary(opts: ITtscResolveOptions = {}): string | null {
  const env = opts.env ?? process.env;

  // 1. Env override. Absolute path is required; a relative value is ignored so
  //    tests can't accidentally resolve something outside the intended tree.
  if (env.TTSC_BINARY && path.isAbsolute(env.TTSC_BINARY)) {
    return env.TTSC_BINARY;
  }

  // 2. Platform-specific optional dependency (the published distribution path).
  const resolver = opts.resolver ?? ((req: string) => require.resolve(req));
  try {
    return resolver(platformPackageRequest(opts));
  } catch {
    /* fall through */
  }

  // 3. Package-local fallback: <package>/native/ttsc-native.
  if (opts.localBinaryLookup) {
    const local = opts.localBinaryLookup();
    if (local) return local;
  } else {
    const local = defaultLocalBinaryPath(opts);
    if (local) return local;
  }

  return null;
}

/**
 * Human-readable message shown when no binary can be located. Pure string —
 * the launcher writes it to stderr.
 */
export function installHint(opts: ITtscResolveOptions = {}): string {
  const key = platformKey(opts);
  const pkg = `@ttsc/${key}`;
  const supported = SUPPORTED_PLATFORMS.join(", ");
  return [
    `ttsc: platform-specific helper binary not found (${pkg}).`,
    `Platform: ${opts.platform ?? process.platform}/${opts.arch ?? process.arch}.`,
    ``,
    `Resolution order:`,
    `  1. TTSC_BINARY env var (absolute path)`,
    `  2. ${pkg} optional dependency`,
    `  3. ./native/ttsc-native (local workspace build)`,
    ``,
    `Try:`,
    `  npm install --include=optional ${pkg}`,
    `  pnpm install --shamefully-hoist`,
    ``,
    `Supported platforms: ${supported}.`,
    `If your platform is not in that list, open an issue at`,
    `https://github.com/samchon/ttsc/issues.`,
  ].join("\n");
}

function defaultLocalBinaryPath(opts: ITtscResolveOptions): string | null {
  const root = packageRootDir(opts);
  const candidate = path.resolve(
    root,
    "..",
    "native",
    (opts.platform ?? process.platform) === "win32" ? "ttsc-native.exe" : "ttsc-native",
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function packageRootDir(opts: ITtscResolveOptions = {}): string {
  if (opts.moduleDir) {
    return fs.realpathSync.native?.(opts.moduleDir) ?? fs.realpathSync(opts.moduleDir);
  }
  return fs.realpathSync.native?.(__dirname) ?? fs.realpathSync(__dirname);
}
