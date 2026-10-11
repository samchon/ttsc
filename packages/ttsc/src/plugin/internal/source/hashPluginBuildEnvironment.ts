import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { GoEnvironmentReading } from "./GoEnvironmentReading";
import { GoSourceInputs } from "./GoSourceInputs";
import { GoToolResolution } from "./GoToolResolution";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "./PluginContentIdentities";
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
 * The declared source/build identity uses these selected observations, so both
 * the plugin cache key (`computeCacheKey`) and the state a transform reports
 * for each source directory (`pluginSourceState`) take it from here, one rule
 * for the build and consumers comparing that selected identity. Failed Go env
 * queries or normalization can fall back to available effective environment
 * values; this is not proof that every Go-reported setting was observed.
 * Command tokens are inspected against the current process cwd and executable
 * search environment; programs a launcher selects by other means remain outside
 * the named-token observation. Native reads and metadata-qualified memos are
 * sequential, not an atomic toolchain snapshot.
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
 * @param identities Record store that lets a new process prove the GOROOT
 *   corpus and executable bytes from their metadata (`PluginContentIdentities`,
 *   #1722); without it every process reads them.
 * @evidence contracts/common.md#principled-implementation Fixed artifact flags, observed compiler bytes/version, selected reported-or-fallback build values, named command executables and selected SDK files enter the same framed identity used by source-state reporting. Fallback values and metadata-qualified reuse are explicit premises, not complete observation of arbitrary toolchain inputs.
 * @evidence contracts/common.md#clear-and-simple-design Private helpers separate compiler identity, Go-reported settings, external variables and SDK content while sharing one hash sink and optional pre-read witness.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cache signatures include real identity/change metadata and effective invocation context; failed SDK witnessing refuses reuse rather than accepting a VERSION-only proxy.
 * @evidence contracts/common.md#meaningful-documentation Native documentation names the input classes and witness purpose; private comments explain context-sensitive compiler memoization and SDK exclusions without treating a passing check as proof.
 * @evidence contracts/portability.md#os-neutral-implementation Node path/stat/process APIs resolve native tool identities; platform-specific executable suffixes and environment lookup are isolated in GoToolResolution, and Go supplies its own effective build settings.
 * @evidence contracts/performance.md#efficient-algorithms SDK traversal sorts reached entry names and selected file paths, performs native stat/realpath/link queries and serializes topology/metadata/path text. Matching manifests share aggregate hashes; changes read full selected files via the caller adapter, retaining file buffers with population/topology data. Compiler misses capture at most three complete version/byte readings when native metadata moves during a reading; only a stable attempt enters the memo. Go env can run up to three times for its file witness, and command tokens can each perform executable searches/full reads. Environment sorting/framing and command substring parsing also process name/value/command bytes; E/D/F/B alone do not capture native lookup or text comparison costs.
 * @evidence contracts/performance.md#reuse-equivalent-work Compiler memo identity includes selected path/file metadata and invocation cwd/environment; SDK aggregate reuse requires matching complete ordered metadata/topology. With a record store, a new process reuses the SDK aggregate and executable digests only while their signatures match the recorded ones and every stamp is separable from a freshly minted reference (#1722); `go version` and `go env` stay live because they report toolchain selection no file metadata shows. All of this relies on native metadata distinguishability and sequential observation premises. Physical directories expand once per selection policy while aliases retain edges; optional caller witnesses receive reached selected dependencies.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Compiler, Go-environment-path and SDK maps retain historical distinct tool/context/root keys without eviction; persisted records belong to the single-file collector. SDK population/topology and full individual file reads contribute transient bytes; synchronous probes delegate process/capture lifetime to their owner and do not certify arbitrary descendants are gone. No independent entry/record/file/output byte ceiling is imposed here.
 */
export function hashPluginBuildEnvironment(
  hash: { update(data: string): unknown },
  goBinary: string | undefined,
  directory: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
  witness?: PluginBuildEnvironmentWitness.Record,
  identities?: PluginContentIdentities.Store,
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
        resolveGoCompilerIdentity(
          goBinary,
          env,
          directory,
          witness,
          identities,
        ),
      ]),
    );
  }
  hashGoBuildEnvironment(
    hash,
    goBinary,
    directory,
    env,
    filesystem,
    witness,
    identities,
  );
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
// same toolchain would otherwise repeat version probes and compiler-byte
// hashes. Identity includes the selected binary and version result under its
// invocation context; the memo key mixes resolved path with a native
// content signature (filesystem identity, mode, byte size, and nanosecond
// change/modify times). That signature changes if a long-lived host rewrites
// or atomically replaces the binary between calls, so the memo re-derives the
// identity under the metadata-distinguishability premise. A hit does not
// independently reread binary content. The selected compiler
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
  identities?: PluginContentIdentities.Store,
): string {
  const selected = GoToolResolution.resolveGoToolForBuild(
    goBinary,
    env,
    cwd,
    witness,
  );
  const resolved =
    process.platform === "win32"
      ? resolveRealPath(selected)
      : resolveExecutableIdentityPath(selected, env, cwd);
  const compilerEnv = GoSourceInputs.goBuildEnv(selected, undefined, env);
  const candidateWitness: PluginBuildEnvironmentWitness.Record = new Map();
  PluginBuildEnvironmentWitness.add(candidateWitness, resolved);
  const candidateKey = goCompilerIdentityMemoKey(
    goBinary,
    resolved,
    compilerEnv,
    cwd,
  );
  if (candidateKey !== null) {
    const cached = goCompilerIdentityCache.get(candidateKey);
    if (cached !== undefined) {
      for (const [file, signature] of candidateWitness)
        if (witness !== undefined && !witness.has(file))
          witness.set(file, signature);
      return cached;
    }
  }
  // Executing a fresh native image can move its metadata, even across more
  // than one execution. Discard that whole reading and start with new pre-read
  // evidence; never bless it by overwriting the witness after execution.
  // The bound limits active observation, not how many metadata changes are
  // accepted: an executable that keeps moving leaves the reading refused.
  let identity = "missing";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed: PluginBuildEnvironmentWitness.Record = new Map();
    PluginBuildEnvironmentWitness.add(observed, resolved);
    const memoKey = goCompilerIdentityMemoKey(
      goBinary,
      resolved,
      compilerEnv,
      cwd,
    );
    identity = computeGoCompilerIdentity(
      selected,
      resolved,
      compilerEnv,
      cwd,
      identities,
    );
    if (!PluginBuildEnvironmentWitness.holds(observed)) continue;
    for (const [file, signature] of observed)
      if (witness !== undefined && !witness.has(file))
        witness.set(file, signature);
    if (memoKey !== null) goCompilerIdentityCache.set(memoKey, identity);
    return identity;
  }
  PluginBuildEnvironmentWitness.refuse(witness, resolved);
  return identity;
}

// Build a memo key from resolved path, native metadata and invocation context,
// not a retained handle or fresh content hash. Unavailable stat returns null
// and skips memo reuse.
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
  identities: PluginContentIdentities.Store | undefined,
): string {
  if (!fs.existsSync(resolved)) {
    return "missing";
  }
  // `go version` stays a live probe: it answers which toolchain the effective
  // environment selects (GOTOOLCHAIN, go.mod), which no file metadata shows.
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
  const binaryHash = hashExecutable(resolved, identities);
  return `sha256:${binaryHash}:${versionText}`;
}

/**
 * The content digest of an executable, proven from its metadata in a process
 * that has the record store (#1722) and read in full otherwise.
 */
function hashExecutable(
  file: string,
  identities: PluginContentIdentities.Store | undefined,
): string {
  return PluginContentIdentities.digest(
    identities,
    "executable",
    file,
    (references) => PluginContentIdentities.fileObservation(references, file),
    () => hashFile(file),
  );
}

function resolveExecutableIdentityPath(
  binary: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  witness?: PluginBuildEnvironmentWitness.Record,
): string {
  const resolved = findExecutablePath(binary, env, cwd, witness);
  return resolved === null ? binary : resolveRealPath(resolved);
}

function findExecutablePath(
  binary: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
  witness?: PluginBuildEnvironmentWitness.Record,
): string | null {
  for (const candidate of GoToolResolution.executableSearchBases(
    binary,
    env,
    cwd,
    witness,
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
  witness: PluginBuildEnvironmentWitness.Record | undefined,
  identities: PluginContentIdentities.Store | undefined,
): void {
  const values = resolveGoBuildEnvironment(
    goBinary,
    cwd,
    env,
    filesystem,
    witness,
    identities,
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
  witness: PluginBuildEnvironmentWitness.Record | undefined,
  identities: PluginContentIdentities.Store | undefined,
): Map<string, string> {
  const values = new Map<string, string>();
  if (goBinary !== undefined) {
    const parsed = GoEnvironmentReading.read(
      goBinary,
      cwd,
      env,
      GO_BUILD_ENV_KEYS,
      witness,
      identities,
    );
    if (parsed !== undefined) {
      try {
        for (const key of GO_BUILD_ENV_KEYS) {
          const raw = parsed[key];
          if (typeof raw === "string" && raw !== "") {
            values.set(
              key,
              normalizeGoBuildEnvValue(
                key,
                raw,
                env,
                filesystem,
                witness,
                identities,
              ),
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
        normalizeGoBuildEnvValue(
          key,
          value,
          env,
          filesystem,
          witness,
          identities,
        ),
      );
    }
  }
  return values;
}

function normalizeGoBuildEnvValue(
  key: string,
  value: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
  witness: PluginBuildEnvironmentWitness.Record | undefined,
  identities: PluginContentIdentities.Store | undefined,
): string {
  if (key === "GOROOT") {
    // Root/version observations also cover a missing SDK. The complete SDK
    // manifest below witnesses contributing files and directories, including
    // nested content changes that do not move the root or VERSION metadata.
    PluginBuildEnvironmentWitness.add(witness, value);
    PluginBuildEnvironmentWitness.add(witness, path.join(value, "VERSION"));
    return resolveGoRootCacheIdentity(value, filesystem, witness, identities);
  }
  if (GO_BUILD_COMMAND_ENV_KEYS.has(key)) {
    return `${value}\0${resolveCommandCacheIdentity(
      value,
      env,
      witness,
      identities,
    )}`;
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
 * first token would keep the key when the delegated compiler is replaced. A
 * token that names no executable file, a flag, is part of the command's text,
 * which the key carries beside this identity. A program a launcher finds by its
 * own means, not named in the command, is outside what the command can show.
 */
function resolveCommandCacheIdentity(
  command: string,
  env: NodeJS.ProcessEnv,
  witness: PluginBuildEnvironmentWitness.Record | undefined,
  identities: PluginContentIdentities.Store | undefined,
): string {
  const tokens = splitGoCommand(command);
  if (tokens === null) {
    return `command:unterminated:${command}`;
  }
  const [executable, ...args] = tokens;
  if (executable === undefined) {
    return "command:empty";
  }
  const resolved = resolveExecutableIdentityPath(
    executable,
    env,
    process.cwd(),
    witness,
  );
  PluginBuildEnvironmentWitness.add(witness, resolved);
  if (!fs.existsSync(resolved)) {
    return `command:missing:${executable}`;
  }
  let identity: string;
  try {
    identity = `command:sha256:${hashExecutable(resolved, identities)}`;
  } catch {
    return `command:unreadable:${resolved}`;
  }
  args.forEach((arg, index) => {
    const operand = resolveExecutableIdentityPath(
      arg,
      env,
      process.cwd(),
      witness,
    );
    if (!GoToolResolution.isExecutableFile(operand)) return;
    PluginBuildEnvironmentWitness.add(witness, operand);
    try {
      identity += `;${index + 1}:sha256:${hashExecutable(operand, identities)}`;
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

  /** Whether every file stamp precedes its device's minted reference. */
  separable: boolean;
}

interface GoRootIdentityCacheEntry {
  identity: string;
  signature: string;
}

// GOROOT is usually stable but its selected source/tool payloads contribute to
// every plugin key. Retain only the final aggregate
// identity, guarded by a fresh metadata/topology manifest on every call. A
// changed or incomplete manifest falls through to the record store, then to a
// full content read.
//
// WARNING (#1186, #1722): this map lives only as long as the process. #1186
// stopped at it, so every CLI launch, worker and bundler restart still read the
// whole SDK (3,723 files, 135 MB for the bundled toolchain). The record store
// below is what carries the identity across processes; never drop it in favor
// of this memo alone.
const goRootIdentityCache = new Map<string, GoRootIdentityCacheEntry>();

function resolveGoRootCacheIdentity(
  goRoot: string,
  filesystem: SourceBuildFilesystemOperations,
  witness: PluginBuildEnvironmentWitness.Record | undefined,
  identities: PluginContentIdentities.Store | undefined,
): string {
  const resolved = resolveRealPath(goRoot);
  if (!fs.existsSync(resolved)) {
    return `missing:${goRoot}`;
  }
  const snapshot = collectGoRootIdentitySnapshot(
    resolved,
    witness,
    identities?.references,
  );
  if (!snapshot.complete)
    PluginBuildEnvironmentWitness.refuse(witness, resolved);
  if (snapshot.complete) {
    const cached = goRootIdentityCache.get(resolved);
    if (cached?.signature === snapshot.signature) {
      return cached.identity;
    }
  }
  // The first observation is the snapshot the witness just recorded; a second
  // one, after the content read, brackets that read for publication.
  let observed = 0;
  const identity = PluginContentIdentities.digest(
    snapshot.complete ? identities : undefined,
    "goroot",
    resolved,
    (references) => {
      const current =
        observed++ === 0
          ? snapshot
          : collectGoRootIdentitySnapshot(resolved, undefined, references);
      return current.complete
        ? { separable: current.separable, signature: current.signature }
        : undefined;
    },
    () => {
      const hash = crypto.createHash("sha256");
      hash.update(JSON.stringify(snapshot.topology));
      for (const file of snapshot.files) {
        const relative = path
          .relative(resolved, file)
          .split(path.sep)
          .join("/");
        const contents = filesystem.readFile(file);
        hash.update(JSON.stringify([relative, contents.length]));
        hash.update(contents);
      }
      return `sha256:${hash.digest("hex")}`;
    },
  );
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
  references?: ReadonlyMap<bigint, bigint>,
): GoRootIdentitySnapshot {
  const out: string[] = [];
  const state = { complete: true, separable: references !== undefined };
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
      if (
        references === undefined ||
        !PluginContentIdentities.separable(references, stats)
      )
        state.separable = false;
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
    separable: state.separable,
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
