import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { GoSourceInputs } from "./GoSourceInputs";
import { GoToolResolution } from "./GoToolResolution";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { spawnGoTool } from "./spawnGoTool";

/**
 * Hash the environment a plugin build is keyed on into `hash`: the Go
 * compiler's identity (its `go version` and the bytes of the binary), the Go
 * build environment `go env` reports for the build's directory (target, build
 * tags, cgo, FIPS, the C toolchain's commands by content, and GOROOT by
 * content), and the external toolchain environment cgo reads. Fixed
 * source-build flags enter this same identity, so its binary key and reported
 * source state both distinguish the artifact policy used by native
 * compilation.
 *
 * A plugin binary is a function of its sources and of this environment, so both
 * the plugin cache key (`computeCacheKey`) and the state a transform reports
 * for each source directory (`pluginSourceState`) take it from here, one rule
 * for the build and for every consumer that proves the build's output
 * (samchon/ttsc#1493).
 *
 * @param hash What the environment's framed values enter: the key's hash, or
 *   one that digests the environment alone, or both at once.
 * @param goBinary The Go tool the build runs, resolved for `directory`
 *   (`GoToolResolution.resolveGoToolForBuild`), or `undefined` to key on the
 *   environment's own values alone.
 * @param directory The directory the build runs `go` in.
 * @param env The build's effective environment.
 * @param filesystem Reads GOROOT's files for its content identity.
 * @param witness Receives every path whose state the reading depends on and no
 *   variable carries: the Go tool, the Go environment file `go env -w` writes,
 *   the executables the C toolchain commands name, and GOROOT. A consumer that
 *   keeps the reading compares their metadata before reusing it.
 * @evidence contracts/common.md#principled-implementation Fixed artifact flags, compiler bytes/version, selected Go build values, command executables and contributing SDK files enter a deterministic digest; source-state reporting uses this same serialization rather than a second definition of toolchain identity.
 * @evidence contracts/common.md#clear-and-simple-design Private helpers separate compiler identity, Go-reported settings, external variables and SDK content while sharing one hash sink and optional pre-read witness.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cache signatures include real identity/change metadata and effective invocation context; failed SDK witnessing refuses reuse rather than accepting a VERSION-only proxy.
 * @evidence contracts/common.md#meaningful-documentation Native documentation names the input classes and witness purpose; private comments explain context-sensitive compiler memoization and SDK exclusions without treating a passing check as proof.
 * @evidence contracts/portability.md#os-neutral-implementation Node path/stat/process APIs resolve native tool identities; platform-specific executable suffixes and environment lookup are isolated in GoToolResolution, and Go supplies its own effective build settings.
 * @evidence contracts/performance.md#efficient-algorithms SDK traversal observes E entries in D reached directories, sorts each directory population and F selected files, and frames link topology; changed manifests read B selected bytes while matching manifests reuse their aggregate. Compiler/context misses additionally execute Go version probing and read compiler or command bytes; effective environment framing scales with its values.
 * @evidence contracts/performance.md#reuse-equivalent-work Compiler identity shares only matching realpath, file signature and invocation cwd/environment; the SDK aggregate identity reuses only an identical ordered metadata and target-topology manifest. Physical directories expand once per selection policy while aliases retain explicit edges, and every reached SDK dependency enters the caller's witness.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This module retains compiler, Go-environment-path and SDK identity maps for process lifetime. Existing entries can be replaced but historical distinct tool/context/root keys have no eviction bound; no subprocess handle remains after synchronous probing.
 */
export function hashPluginBuildEnvironment(
  hash: { update(data: string): unknown },
  goBinary: string | undefined,
  directory: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
  witness?: PluginBuildEnvironmentWitness.Record,
): void {
  // Fixed artifact policy must invalidate binaries and reported source states
  // together, including binaries cached before this policy was introduced.
  hash.update(
    JSON.stringify(["source-build-flags", GoSourceInputs.BUILD_FLAGS]),
  );
  if (goBinary !== undefined) {
    hash.update(
      JSON.stringify([
        "go",
        resolveGoCompilerIdentity(goBinary, env, directory, witness),
      ]),
    );
  }
  hashGoBuildEnvironment(hash, goBinary, directory, env, filesystem, witness);
  hashExternalGoBuildEnvironment(hash, env);
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
// path is shared by every build subprocess, while `go version` uses
// the same effective cwd and environment as the cache-key `go env` query. The
// memo key includes that context so an environment-sensitive wrapper cannot
// lend its version result to another compiler invocation.
const goCompilerIdentityCache = new Map<string, string>();

function resolveGoCompilerIdentity(
  goBinary: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  witness?: PluginBuildEnvironmentWitness.Record,
): string {
  const selected = GoToolResolution.resolveGoToolForBuild(goBinary, env, cwd);
  const resolved =
    process.platform === "win32"
      ? resolveRealPath(selected)
      : resolveExecutableIdentityPath(selected, env, cwd);
  PluginBuildEnvironmentWitness.add(witness, resolved);
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
    return fs.realpathSync.native(location);
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
  hash: { update(data: string): unknown },
  goBinary: string | undefined,
  cwd: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
  witness?: PluginBuildEnvironmentWitness.Record,
): void {
  const values = resolveGoBuildEnvironment(
    goBinary,
    cwd,
    env,
    filesystem,
    witness,
  );
  for (const key of GO_BUILD_ENV_KEYS) {
    const value = values.get(key);
    if (value !== undefined && value !== "") {
      hash.update(JSON.stringify([key, value]));
    }
  }
}

function resolveGoBuildEnvironment(
  goBinary: string | undefined,
  cwd: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
  witness?: PluginBuildEnvironmentWitness.Record,
): Map<string, string> {
  const values = new Map<string, string>();
  if (goBinary !== undefined) {
    const parsed = readGoEnvironment(goBinary, cwd, env, witness);
    if (parsed !== undefined) {
      try {
        for (const key of GO_BUILD_ENV_KEYS) {
          const raw = parsed[key];
          if (typeof raw === "string" && raw !== "") {
            values.set(
              key,
              normalizeGoBuildEnvValue(key, raw, env, filesystem, witness),
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
      values.set(
        key,
        normalizeGoBuildEnvValue(key, value, env, filesystem, witness),
      );
    }
  }
  return values;
}

/**
 * The Go environment file each Go tool and environment was last seen to name,
 * which lets a reading witness that file before `go env` reads it.
 */
const goEnvironmentFiles = new Map<string, string | null>();

/**
 * Run `go env -json` for the build keys and `GOENV`, the file `go env -w`
 * writes, witnessing that file before the run reads it.
 *
 * The file decides the reading without being part of it, so only its metadata
 * is kept, and it must be taken before the read: metadata taken after would
 * describe an edit that landed between the two, and a reading of the old
 * content would pass as proven. Which file `go env` reads is known only from
 * its answer, so the file this Go tool and environment named last is witnessed
 * first, and a reading that names another is taken again with that one
 * witnessed. A file that keeps moving between runs leaves the reading
 * unwitnessable, so a kept reading or a build keyed on it never holds.
 *
 * @returns The parsed answer, or `undefined` when `go env` failed.
 */
function readGoEnvironment(
  goBinary: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  witness: PluginBuildEnvironmentWitness.Record | undefined,
): Record<string, unknown> | undefined {
  const memo = crypto.createHash("sha256").update(goBinary);
  for (const [key, value] of Object.entries(env).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    if (value !== undefined)
      memo.update(`\0${key.length}:${key}${value.length}:${value}`);
  }
  const memoKey = memo.digest("hex");
  let named = goEnvironmentFiles.get(memoKey);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (named !== undefined && named !== null)
      PluginBuildEnvironmentWitness.add(witness, named);
    const result = spawnGoTool(
      goBinary,
      ["env", "-json", ...GO_BUILD_ENV_KEYS, "GOENV"],
      {
        cwd,
        encoding: "utf8",
        env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        windowsHide: true,
      },
    );
    if (result.error !== undefined || result.status !== 0) return undefined;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    } catch {
      return undefined;
    }
    const reported =
      typeof parsed.GOENV === "string" &&
      parsed.GOENV !== "" &&
      parsed.GOENV !== "off"
        ? parsed.GOENV
        : null;
    if (reported === named) return parsed;
    if (named !== undefined && named !== null) witness?.delete(named);
    named = reported;
    goEnvironmentFiles.set(memoKey, named);
    // No file to witness: the reading depends on none.
    if (named === null) return parsed;
    if (witness === undefined) return parsed;
  }
  if (named !== undefined && named !== null)
    PluginBuildEnvironmentWitness.refuse(witness, named);
  return undefined;
}

function normalizeGoBuildEnvValue(
  key: string,
  value: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
  witness?: PluginBuildEnvironmentWitness.Record,
): string {
  if (key === "GOROOT") {
    // Root/version observations also cover a missing SDK. The complete SDK
    // manifest below witnesses contributing files and directories, including
    // nested content changes that do not move the root or VERSION metadata.
    PluginBuildEnvironmentWitness.add(witness, value);
    PluginBuildEnvironmentWitness.add(witness, path.join(value, "VERSION"));
    return resolveGoRootCacheIdentity(value, filesystem, witness);
  }
  if (GO_BUILD_COMMAND_ENV_KEYS.has(key)) {
    return `${value}\0${resolveCommandCacheIdentity(value, env, witness)}`;
  }
  return value;
}

/**
 * The content identity of a C toolchain command such as `CC`, split as Go
 * splits it, with every token that names an executable file hashed.
 *
 * Go runs the value as a command and its arguments (`cmd/internal/quoted`), so
 * a launcher such as `ccache gcc` or a wrapper followed by the compiler it
 * delegates to names more than one program the build runs. Hashing only the
 * first token kept the key when the delegated compiler was replaced
 * (samchon/ttsc#1555). A token that names no executable file, a flag, is part
 * of the command's text, which the key carries beside this identity. A program
 * a launcher finds by its own means, not named in the command, is outside what
 * the command can show.
 */
function resolveCommandCacheIdentity(
  command: string,
  env: NodeJS.ProcessEnv,
  witness?: PluginBuildEnvironmentWitness.Record,
): string {
  const tokens = splitGoCommand(command);
  if (tokens === null) {
    return `command:unterminated:${command}`;
  }
  const [executable, ...args] = tokens;
  if (executable === undefined) {
    return "command:empty";
  }
  const resolved = resolveExecutableIdentityPath(executable, env);
  PluginBuildEnvironmentWitness.add(witness, resolved);
  if (!fs.existsSync(resolved)) {
    return `command:missing:${executable}`;
  }
  let identity: string;
  try {
    identity = `command:sha256:${hashFile(resolved)}`;
  } catch {
    return `command:unreadable:${resolved}`;
  }
  args.forEach((arg, index) => {
    const operand = resolveExecutableIdentityPath(arg, env);
    if (!GoToolResolution.isExecutableFile(operand)) return;
    PluginBuildEnvironmentWitness.add(witness, operand);
    try {
      identity += `;${index + 1}:sha256:${hashFile(operand)}`;
    } catch {
      identity += `;${index + 1}:unreadable:${operand}`;
    }
  });
  return identity;
}

/**
 * Split a command value the way Go's `cmd/internal/quoted.Split` does:
 * whitespace separates fields, and a field may be wrapped whole in single or
 * double quotes, with nothing unescaped inside. `null` for an unterminated
 * quote, which Go rejects.
 */
function splitGoCommand(command: string): string[] | null {
  const fields: string[] = [];
  let rest = command;
  const space = (char: string | undefined): boolean =>
    char === " " || char === "\t" || char === "\n" || char === "\r";
  while (rest.length !== 0) {
    let start = 0;
    while (start < rest.length && space(rest[start])) start += 1;
    rest = rest.slice(start);
    if (rest.length === 0) break;
    const quote = rest[0];
    if (quote === '"' || quote === "'") {
      const end = rest.indexOf(quote, 1);
      if (end === -1) return null;
      fields.push(rest.slice(1, end));
      rest = rest.slice(end + 1);
      continue;
    }
    let end = 0;
    while (end < rest.length && !space(rest[end])) end += 1;
    fields.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  return fields;
}

function hashExternalGoBuildEnvironment(
  hash: { update(data: string): unknown },
  env: NodeJS.ProcessEnv,
): void {
  for (const key of EXTERNAL_GO_BUILD_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined && value !== "") {
      hash.update(JSON.stringify([key, value]));
    }
  }
}

interface GoRootIdentitySnapshot {
  complete: boolean;
  files: string[];
  topology: string[];
  signature: string;
}

interface GoRootIdentityCacheEntry {
  identity: string;
  signature: string;
}

// GOROOT is usually stable but its selected source/tool payloads contribute to
// every plugin key. Retain only the final aggregate
// identity, guarded by a fresh metadata/topology manifest on every call. A
// changed or incomplete manifest falls through to the historical full read.
const goRootIdentityCache = new Map<string, GoRootIdentityCacheEntry>();

function resolveGoRootCacheIdentity(
  goRoot: string,
  filesystem: SourceBuildFilesystemOperations,
  witness?: PluginBuildEnvironmentWitness.Record,
): string {
  const resolved = resolveRealPath(goRoot);
  if (!fs.existsSync(resolved)) {
    return `missing:${goRoot}`;
  }
  const snapshot = collectGoRootIdentitySnapshot(resolved, witness);
  if (!snapshot.complete)
    PluginBuildEnvironmentWitness.refuse(witness, resolved);
  if (snapshot.complete) {
    const cached = goRootIdentityCache.get(resolved);
    if (cached?.signature === snapshot.signature) {
      return cached.identity;
    }
  }
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(snapshot.topology));
  for (const file of snapshot.files) {
    const relative = path.relative(resolved, file).split(path.sep).join("/");
    const contents = filesystem.readFile(file);
    hash.update(JSON.stringify([relative, contents.length]));
    hash.update(contents);
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

function collectGoRootIdentitySnapshot(
  root: string,
  witness?: PluginBuildEnvironmentWitness.Record,
): GoRootIdentitySnapshot {
  const out: string[] = [];
  const state = { complete: true };
  const topology: string[] = [];
  walkGoRootIdentity(root, out, topology, state, witness);
  out.sort();
  const signature = crypto.createHash("sha256");
  signature.update(JSON.stringify(topology));
  for (const file of out) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    try {
      const stats = fs.statSync(file, { bigint: true });
      PluginBuildEnvironmentWitness.add(witness, file, stats);
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
    topology,
    signature: signature.digest("hex"),
  };
}

function walkGoRootIdentity(
  root: string,
  out: string[],
  topology: string[],
  state: { complete: boolean },
  witness?: PluginBuildEnvironmentWitness.Record,
): void {
  // Go follows SDK junctions and file links. Observe the same target, including
  // link topology, rather than certifying an incomplete ordinary-file tree.
  // A physical directory is expanded once per selection policy; repeated
  // aliases and cycles remain explicit edges without unbounded recursion.
  const pending = [root];
  const visited = new Set<string>();
  while (pending.length !== 0) {
    const dir = pending.pop()!;
    const relative = path.relative(root, dir).split(path.sep).join("/");
    PluginBuildEnvironmentWitness.add(witness, dir);
    let entries: fs.Dirent[];
    try {
      const physical = fs.realpathSync.native(dir);
      const target = path.relative(root, physical).split(path.sep).join("/");
      topology.push(JSON.stringify([relative, target]));
      // The SDK root selects compiler/source regions. Within any selected
      // region, every payload can contribute through imports, embeds or tools.
      // A source alias back to the root therefore needs its broader expansion.
      const policy = relative === "" ? "root" : "selected-subtree";
      const key = JSON.stringify([physical, policy]);
      if (visited.has(key)) continue;
      visited.add(key);
      entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    } catch {
      state.complete = false;
      continue;
    }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      const rel = path.relative(root, file).split(path.sep).join("/");
      let directory = entry.isDirectory();
      let regular = entry.isFile();
      if (entry.isSymbolicLink()) {
        if (
          !shouldHashGoRootPath(rel, true) &&
          !shouldHashGoRootPath(rel, false)
        )
          continue;
        PluginBuildEnvironmentWitness.addLink(witness, file);
        PluginBuildEnvironmentWitness.add(witness, file);
        try {
          topology.push(JSON.stringify([rel, "link", fs.readlinkSync(file)]));
          const stats = fs.statSync(file, { bigint: true });
          directory = stats.isDirectory();
          regular = stats.isFile();
          topology.push(
            JSON.stringify([
              rel,
              path
                .relative(root, fs.realpathSync.native(file))
                .split(path.sep)
                .join("/"),
            ]),
          );
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== "ENOENT" && code !== "ENOTDIR") state.complete = false;
          else {
            // A stable dangling target is an observed absence, not unreadable
            // environment state. Go can build packages that do not use it;
            // following-target and link witnesses reject later appearances
            // and retargeting before publication or environment reuse.
            try {
              if (!fs.lstatSync(file).isSymbolicLink()) state.complete = false;
              else topology.push(JSON.stringify([rel, "missing-target"]));
            } catch {
              state.complete = false;
            }
          }
          continue;
        }
      }
      if (directory && shouldHashGoRootPath(rel, true)) pending.push(file);
      else if (regular && shouldHashGoRootPath(rel, false)) out.push(file);
    }
  }
}

function shouldHashGoRootPath(rel: string, isDir: boolean): boolean {
  if (rel === "") return true;
  const parts = rel.split("/");
  const first = parts[0]!;
  if (parts.length === 1) {
    if (isDir) return ["bin", "pkg", "src", "lib"].includes(first);
    return ["VERSION", "go.env"].includes(first);
  }
  return ["bin", "pkg", "src", "lib"].includes(first);
}
