import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";
import { GoToolResolution } from "./GoToolResolution";
import type { ITtscBuildContributor } from "./ITtscBuildContributor";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { pluginSourceDigest } from "./pluginSourceDigest";
import { spawnGoTool } from "./spawnGoTool";

/**
 * Compute a deterministic SHA-256 cache key for a plugin build.
 *
 * The key covers every input that can produce a different binary: ttsc/tsgo
 * versions, platform, entry package, Go compiler identity, Go build environment
 * variables, overlay module sources, plugin source files, and contributor
 * source files. Contributors are sorted by name so declaration order does not
 * affect the key.
 *
 * Each source directory enters the key as its digest (`pluginSourceDigest`),
 * the state the transform envelope reports for it, so what a consumer proves is
 * exactly what the binary was keyed on (samchon/ttsc#1487). `sourceDigests`
 * carries the digests one load already took: every build of the load keys on
 * one reading of each directory, and the load reports those readings.
 *
 * Exposed for testing and for the `ttsc cache` CLI command.
 */
export function computeCacheKey(inputs: {
  contributors?: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  env?: NodeJS.ProcessEnv;
  filesystem?: Partial<SourceBuildFilesystemOperations>;
  goBinary?: string;
  overlayDirs?: readonly string[];
  /**
   * Digests of the source directories this load already read, by absolute path.
   * Read through, and filled with every directory this key covers.
   */
  sourceDigests?: Map<string, string>;
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const env = inputs.env ?? process.env;
  const filesystem: SourceBuildFilesystemOperations = {
    readFile:
      inputs.filesystem?.readFile ?? DEFAULT_SOURCE_BUILD_FILESYSTEM.readFile,
  };
  const goBinary =
    inputs.goBinary === undefined
      ? undefined
      : GoToolResolution.resolveGoToolForBuild(
          inputs.goBinary,
          env,
          inputs.dir,
        );
  const hash = crypto.createHash("sha256");
  hash.update(`ttsc=${inputs.ttscVersion}\n`);
  hash.update(`tsgo=${inputs.tsgoVersion}\n`);
  hash.update(`platform=${process.platform}/${process.arch}\n`);
  hash.update(`entry=${inputs.entry}\n`);
  if (goBinary !== undefined) {
    hash.update(`go=${resolveGoCompilerIdentity(goBinary, env, inputs.dir)}\n`);
  }
  hashGoBuildEnvironment(hash, goBinary, inputs.dir, env, filesystem);
  hashExternalGoBuildEnvironment(hash, env);
  hashSourceDirectory(hash, "plugin", inputs.dir, inputs.sourceDigests);
  for (const [index, dir] of [...(inputs.overlayDirs ?? [])].sort().entries()) {
    hashSourceDirectory(hash, `overlay:${index}`, dir, inputs.sourceDigests);
  }
  // Hash contributors in sorted-by-name order so two consumers with the
  // same logical set produce the same key regardless of declaration order
  // in the host's plugin descriptor.
  const sortedContributors = [...(inputs.contributors ?? [])].sort((a, b) =>
    a.name === b.name ? 0 : a.name < b.name ? -1 : 1,
  );
  for (const contributor of sortedContributors) {
    hashSourceDirectory(
      hash,
      `contributor:${contributor.name}`,
      contributor.source,
      inputs.sourceDigests,
    );
  }
  return hash.digest("hex").slice(0, 32);
}

// Go build environment values that can change the produced binary or decide
// whether `go build` succeeds. Hashed into the plugin cache key so target,
// build-tag, cgo, FIPS, and external-link variants never collide.
const GO_BUILD_ENV_KEYS: readonly string[] = [
  "GOOS",
  "GOARCH",
  "GOAMD64",
  "GOARM",
  "GOARM64",
  "GO386",
  "GOMIPS",
  "GOMIPS64",
  "GOPPC64",
  "GORISCV64",
  "GOWASM",
  "GOFLAGS",
  "GOEXPERIMENT",
  "GOFIPS140",
  "GO_EXTLINK_ENABLED",
  "GCCGO",
  "GCCGOTOOLDIR",
  "CGO_ENABLED",
  "AR",
  "CC",
  "CXX",
  "FC",
  "PKG_CONFIG",
  "CGO_CFLAGS",
  "CGO_CFLAGS_ALLOW",
  "CGO_CFLAGS_DISALLOW",
  "CGO_CPPFLAGS",
  "CGO_CPPFLAGS_ALLOW",
  "CGO_CPPFLAGS_DISALLOW",
  "CGO_CXXFLAGS",
  "CGO_CXXFLAGS_ALLOW",
  "CGO_CXXFLAGS_DISALLOW",
  "CGO_FFLAGS",
  "CGO_FFLAGS_ALLOW",
  "CGO_FFLAGS_DISALLOW",
  "CGO_LDFLAGS",
  "CGO_LDFLAGS_ALLOW",
  "CGO_LDFLAGS_DISALLOW",
  "GOTOOLCHAIN",
  "GOROOT",
];

const GO_BUILD_COMMAND_ENV_KEYS = new Set([
  "AR",
  "CC",
  "CXX",
  "FC",
  "GCCGO",
  "PKG_CONFIG",
]);

const EXTERNAL_GO_BUILD_ENV_KEYS: readonly string[] = [
  "CPATH",
  "C_INCLUDE_PATH",
  "CPLUS_INCLUDE_PATH",
  "DYLD_LIBRARY_PATH",
  "INCLUDE",
  "LD_LIBRARY_PATH",
  "LIB",
  "LIBRARY_PATH",
  "LIBPATH",
  "MACOSX_DEPLOYMENT_TARGET",
  "OBJC_INCLUDE_PATH",
  "PKG_CONFIG_ALLOW_SYSTEM_CFLAGS",
  "PKG_CONFIG_ALLOW_SYSTEM_LIBS",
  "PKG_CONFIG_LIBDIR",
  "PKG_CONFIG_PATH",
  "PKG_CONFIG_SYSROOT_DIR",
  "PKG_CONFIG_TOP_BUILD_DIR",
  "SDKROOT",
];

const DEFAULT_SOURCE_BUILD_FILESYSTEM: SourceBuildFilesystemOperations =
  Object.freeze({
    readFile: (location: string) => fs.readFileSync(location),
  });

function hashSourceDirectory(
  hash: crypto.Hash,
  label: string,
  root: string,
  digests: Map<string, string> | undefined,
): void {
  const directory = path.resolve(root);
  let digest = digests?.get(directory);
  if (digest === undefined) {
    digest = pluginSourceDigest(directory);
    digests?.set(directory, digest);
  }
  hash.update(`dir=${label}
${digest}
`);
}

// Per-process memo for the Go compiler identity. `computeCacheKey` runs once
// per source plugin, so an N-plugin project that points every plugin at the
// same toolchain would otherwise pay N `go version` spawns plus N ~150MB
// binary hashes for a value that does not change between plugins. The result
// is a pure function of the go binary's resolved real path plus its on-disk
// content; the memo key therefore mixes the resolved real path with a cheap
// content signature (filesystem identity, mode, byte size, and nanosecond
// change/modify times). That signature changes if a long-lived host rewrites
// or atomically replaces the binary between calls, so the memo
// re-derives the identity exactly as the un-memoized code would and the
// cache-key bytes stay byte-for-byte identical to today. The selected compiler
// path is shared by every build subprocess on Windows, while `go version` uses
// the same effective cwd and environment as the cache-key `go env` query. The
// memo key includes that context so an environment-sensitive wrapper cannot
// lend its version result to another compiler invocation.
const goCompilerIdentityCache = new Map<string, string>();

function resolveGoCompilerIdentity(
  goBinary: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const selected = GoToolResolution.resolveGoToolForBuild(goBinary, env, cwd);
  const resolved =
    process.platform === "win32"
      ? resolveRealPath(selected)
      : resolveExecutableIdentityPath(selected, env, cwd);
  const compilerEnv = GoSourceInputs.goBuildEnv(selected, undefined, env);
  const memoKey = goCompilerIdentityMemoKey(
    goBinary,
    resolved,
    compilerEnv,
    cwd,
  );
  if (memoKey !== null) {
    const cached = goCompilerIdentityCache.get(memoKey);
    if (cached !== undefined) {
      return cached;
    }
  }
  const identity = computeGoCompilerIdentity(
    selected,
    resolved,
    compilerEnv,
    cwd,
  );
  if (memoKey !== null) {
    goCompilerIdentityCache.set(memoKey, identity);
  }
  return identity;
}

// Build a memo key that pins both the resolved binary path and its current
// content. Returns null (skip caching, recompute) when the binary cannot be
// stat-ed, so the rare unstattable case never serves a stale identity.
function goCompilerIdentityMemoKey(
  goBinary: string,
  resolved: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string | null {
  try {
    const stat = fs.statSync(resolved, { bigint: true });
    const context = crypto.createHash("sha256");
    context.update(cwd);
    for (const [key, value] of Object.entries(env).sort(([left], [right]) =>
      left === right ? 0 : left < right ? -1 : 1,
    )) {
      if (value === undefined) continue;
      context.update(`\0${key.length}:${key}${value.length}:${value}`);
    }
    return [
      goBinary,
      resolved,
      stat.dev,
      stat.ino,
      stat.mode,
      stat.size,
      stat.mtimeNs,
      stat.ctimeNs,
      context.digest("hex"),
    ].join("\0");
  } catch {
    return null;
  }
}

function computeGoCompilerIdentity(
  goBinary: string,
  resolved: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string {
  if (!fs.existsSync(resolved)) {
    return "missing";
  }
  const version = spawnGoTool(goBinary, ["version"], {
    cwd,
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  const versionText =
    version.error !== undefined
      ? ((version.error as NodeJS.ErrnoException).code ?? version.error.message)
      : `${version.status ?? 0}:${version.stdout}${version.stderr}`;
  const binaryHash = hashFile(resolved);
  return `sha256:${binaryHash}:${versionText}`;
}

function resolveExecutableIdentityPath(
  binary: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const resolved = findExecutablePath(binary, env, cwd);
  return resolved === null ? binary : resolveRealPath(resolved);
}

function findExecutablePath(
  binary: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string | null {
  for (const candidate of GoToolResolution.executableSearchBases(
    binary,
    env,
    cwd,
  )) {
    const resolved = findExecutableCandidate(candidate, env);
    if (resolved !== null) return resolved;
  }
  return null;
}

function findExecutableCandidate(
  candidate: string,
  env: NodeJS.ProcessEnv,
): string | null {
  if (GoToolResolution.isExecutableFile(candidate)) return candidate;
  if (process.platform !== "win32") return null;
  // Probe every PATHEXT extension, not just `.exe`, so a compiler backed by a
  // `.cmd`/`.bat` wrapper is both launched correctly and hashed into the cache
  // key. Otherwise the wrapper reads as missing and changes do not invalidate
  // the cached plugin binary.
  for (const ext of GoToolResolution.windowsExecutableExtensions(env)) {
    const executable = `${candidate}${ext}`;
    if (GoToolResolution.isExecutableFile(executable)) return executable;
  }
  return null;
}

function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

function hashFile(file: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

function hashGoBuildEnvironment(
  hash: crypto.Hash,
  goBinary: string | undefined,
  cwd: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
): void {
  const values = resolveGoBuildEnvironment(goBinary, cwd, env, filesystem);
  for (const key of GO_BUILD_ENV_KEYS) {
    const value = values.get(key);
    if (value !== undefined && value !== "") {
      hash.update(`${key}=${value}\n`);
    }
  }
}

function resolveGoBuildEnvironment(
  goBinary: string | undefined,
  cwd: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
): Map<string, string> {
  const values = new Map<string, string>();
  if (goBinary !== undefined) {
    const result = spawnGoTool(
      goBinary,
      ["env", "-json", ...GO_BUILD_ENV_KEYS],
      {
        cwd,
        encoding: "utf8",
        env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        windowsHide: true,
      },
    );
    if (result.error === undefined && result.status === 0) {
      try {
        const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
        for (const key of GO_BUILD_ENV_KEYS) {
          const raw = parsed[key];
          if (typeof raw === "string" && raw !== "") {
            values.set(
              key,
              normalizeGoBuildEnvValue(key, raw, env, filesystem),
            );
          }
        }
      } catch {
        // Fall back to the effective env below; a cache key is still better
        // than failing before `go build` can produce the actionable error.
      }
    }
  }
  for (const key of GO_BUILD_ENV_KEYS) {
    if (values.has(key)) continue;
    const value = env[key];
    if (value !== undefined && value !== "") {
      values.set(key, normalizeGoBuildEnvValue(key, value, env, filesystem));
    }
  }
  return values;
}

function normalizeGoBuildEnvValue(
  key: string,
  value: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
): string {
  if (key === "GOROOT") {
    return resolveGoRootCacheIdentity(value, filesystem);
  }
  if (GO_BUILD_COMMAND_ENV_KEYS.has(key)) {
    return `${value}\0${resolveCommandCacheIdentity(value, env)}`;
  }
  return value;
}

function resolveCommandCacheIdentity(
  command: string,
  env: NodeJS.ProcessEnv,
): string {
  const executable = firstCommandToken(command);
  if (executable === null) {
    return "command:empty";
  }
  const resolved = resolveExecutableIdentityPath(executable, env);
  if (!fs.existsSync(resolved)) {
    return `command:missing:${executable}`;
  }
  try {
    return `command:sha256:${hashFile(resolved)}`;
  } catch {
    return `command:unreadable:${resolved}`;
  }
}

function firstCommandToken(command: string): string | null {
  const trimmed = command.trim();
  if (trimmed === "") {
    return null;
  }
  const quote = trimmed[0];
  if (quote === "'" || quote === '"') {
    const end = trimmed.indexOf(quote, 1);
    return end === -1 ? trimmed.slice(1) : trimmed.slice(1, end);
  }
  return trimmed.split(/\s+/)[0] ?? null;
}

function hashExternalGoBuildEnvironment(
  hash: crypto.Hash,
  env: NodeJS.ProcessEnv,
): void {
  for (const key of EXTERNAL_GO_BUILD_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined && value !== "") {
      hash.update(`${key}=${value}\n`);
    }
  }
}

interface GoRootIdentitySnapshot {
  complete: boolean;
  files: string[];
  signature: string;
}

interface GoRootIdentityCacheEntry {
  identity: string;
  signature: string;
}

// GOROOT is immutable during normal use but contributes roughly 140 MiB of
// source/tool content to every plugin key. Retain only the final pathless
// content identity, guarded by a fresh metadata manifest on every call. A
// changed or incomplete manifest falls through to the historical full read.
const goRootIdentityCache = new Map<string, GoRootIdentityCacheEntry>();

function resolveGoRootCacheIdentity(
  goRoot: string,
  filesystem: SourceBuildFilesystemOperations,
): string {
  const resolved = resolveRealPath(goRoot);
  if (!fs.existsSync(resolved)) {
    return `missing:${goRoot}`;
  }
  const snapshot = collectGoRootIdentitySnapshot(resolved);
  if (snapshot.complete) {
    const cached = goRootIdentityCache.get(resolved);
    if (cached?.signature === snapshot.signature) {
      return cached.identity;
    }
  }
  const hash = crypto.createHash("sha256");
  for (const file of snapshot.files) {
    const relative = path.relative(resolved, file).replace(/\\/g, "/");
    hash.update(`f=${relative}\n`);
    hash.update(filesystem.readFile(file));
    hash.update("\n");
  }
  const identity = `sha256:${hash.digest("hex")}`;
  if (snapshot.complete) {
    goRootIdentityCache.set(resolved, {
      identity,
      signature: snapshot.signature,
    });
  }
  return identity;
}

function collectGoRootIdentitySnapshot(root: string): GoRootIdentitySnapshot {
  const out: string[] = [];
  const state = { complete: true };
  walkGoRootIdentity(root, root, out, state);
  out.sort();
  const signature = crypto.createHash("sha256");
  for (const file of out) {
    const relative = path.relative(root, file).replace(/\\/g, "/");
    try {
      const stats = fs.statSync(file, { bigint: true });
      if (!stats.isFile()) {
        state.complete = false;
        continue;
      }
      signature.update(
        [
          relative,
          stats.dev,
          stats.ino,
          stats.mode,
          stats.size,
          stats.mtimeNs,
          stats.ctimeNs,
        ].join("\0"),
      );
      signature.update("\n");
    } catch {
      state.complete = false;
    }
  }
  return {
    complete: state.complete,
    files: out,
    signature: signature.digest("hex"),
  };
}

function walkGoRootIdentity(
  root: string,
  dir: string,
  out: string[],
  state: { complete: boolean },
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    state.complete = false;
    return;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (shouldHashGoRootPath(rel, true)) {
        walkGoRootIdentity(root, file, out, state);
      }
    } else if (entry.isFile() && shouldHashGoRootPath(rel, false)) {
      out.push(file);
    }
  }
}

function shouldHashGoRootPath(rel: string, isDir: boolean): boolean {
  if (rel === "") return true;
  const parts = rel.split("/");
  if (parts.includes(".git") || parts.includes("testdata")) return false;
  if (!isDir && rel.endsWith("_test.go")) return false;

  const first = parts[0]!;
  if (parts.length === 1) {
    if (isDir) return ["bin", "pkg", "src", "lib"].includes(first);
    return ["VERSION", "go.env"].includes(first);
  }
  if (first === "bin") {
    if (isDir) return true;
    const base = path.basename(rel);
    return (
      base === "go" ||
      base === "go.exe" ||
      base === "gofmt" ||
      base === "gofmt.exe"
    );
  }
  if (first === "pkg") {
    const second = parts[1]!;
    return second === "tool" || second === "include";
  }
  if (first === "src") {
    if (!isDir && parts.length === 2) {
      return ["go.mod", "go.sum"].includes(parts[1]!);
    }
    return parts[1] !== "cmd";
  }
  if (first === "lib") {
    return parts[1] === "time";
  }
  return false;
}
