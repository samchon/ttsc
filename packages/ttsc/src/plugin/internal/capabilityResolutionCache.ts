import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveSourceBuildCachePaths } from "./buildSourcePlugin";
import {
  hashHostInputPaths,
  realpathHostInputPaths,
} from "./loadProjectPlugins";

/**
 * The answer `resolveCapabilityPlugins` produced for one project, and the exact
 * state that makes it still true.
 *
 * The answer is small and fully serializable — a binary path, a capability map,
 * a manifest string — which is why it is cached here and not one layer down.
 * `loadProjectPlugins` returns live plugin descriptors the compiler drives, and
 * writing those to disk would be caching a different, much larger thing.
 */
export interface ITtscCapabilityResolutionEntry {
  /** Cache format plus the ttsc build that wrote it. */
  version: string;
  /** Paths whose state decides whether this answer is still the answer. */
  hostInputs: string[];
  /** Content hash per host input, `null` for one that does not exist. */
  hostInputHashes: Record<string, string | null>;
  /** Physical identity per host input, so a retargeted link is a change. */
  hostInputRealpaths: Record<string, string | null>;
  /**
   * Fingerprint per plugin Go source directory.
   *
   * The binary path is content-keyed on that source, so a source edit produces
   * a different path — and the cached entry would keep naming the old one,
   * which still exists because the build cache retains it. Nothing in the host
   * inputs moves when a plugin's own Go changes, so this is what notices.
   */
  sources: Record<string, string>;
  /** The `--plugins-json` payload, verbatim. */
  manifest: string;
  /** The `--project-context-json` payload, or `null` when none was wanted. */
  projectContext: string | null;
  /** One entry per configured native plugin, in configured order. */
  plugins: ITtscCapabilityResolutionPlugin[];
}

/** One plugin as the cache records it. */
export interface ITtscCapabilityResolutionPlugin {
  binary: string;
  capabilities: Record<string, boolean>;
  source: string;
}

/**
 * Cache format tag.
 *
 * Moves when the entry shape or the validation rule changes, so an older entry
 * is discarded rather than read under new rules.
 */
const FORMAT = "ttsc-capability-resolution-v1";

/**
 * The character that joins fields a path could otherwise forge.
 *
 * A path cannot contain it, which is the whole reason it is the separator: with
 * a space, a file named `a 1 2` states the same string as a one-byte file named
 * `a`, and an edit to either would read as no edit at all. Built rather than
 * written literally, because a source file carrying a raw NUL is one Git
 * classifies as binary — which silently exempts it from this repository's
 * end-of-line contract and leaves it with no textual diff for a reviewer.
 */
const SEPARATOR = String.fromCharCode(0);

/**
 * Read the recorded answer for a project, or `null` when there is none that is
 * still true.
 *
 * Fail-closed by construction: every path that cannot prove the entry — a
 * missing file, a parse failure, a format bump, a moved input, a rebuilt plugin
 * source, a binary that is gone — returns `null`, and `null` means "walk the
 * project properly". A cache that guessed here would answer "no plugin declares
 * this capability" for a project that had just configured one, which is a wrong
 * answer indistinguishable from the correct answer for the common case.
 */
export function readCapabilityResolution(options: {
  cwd: string;
  tsconfig: string;
  version: string;
  env?: NodeJS.ProcessEnv;
}): ITtscCapabilityResolutionEntry | null {
  const file = resolutionFile(options);
  if (file === null) return null;
  let entry: ITtscCapabilityResolutionEntry;
  try {
    entry = JSON.parse(
      fs.readFileSync(file, "utf8"),
    ) as ITtscCapabilityResolutionEntry;
  } catch {
    return null;
  }
  if (!isEntry(entry) || entry.version !== formatVersion(options.version))
    return null;
  // An entry recording nothing proves nothing. Discovery always reads at least
  // the project's own manifest, so an empty input set is a malformed entry
  // rather than a project with no inputs.
  if (entry.hostInputs.length === 0) return null;
  if (
    !sameMap(entry.hostInputHashes, hashHostInputPaths(entry.hostInputs)) ||
    !sameMap(entry.hostInputRealpaths, realpathHostInputPaths(entry.hostInputs))
  )
    return null;
  for (const [source, fingerprint] of Object.entries(entry.sources))
    if (fingerprintDirectory(source) !== fingerprint) return null;
  for (const plugin of entry.plugins)
    if (!fs.existsSync(plugin.binary)) return null;
  return entry;
}

/**
 * Record the answer and the state it was true for.
 *
 * A write failure is not reported. The cache is an optimization over a walk
 * that still works, and a read-only or full disk is a reason to be slower, not
 * a reason for `resolveCapabilityPlugins` to start throwing at a caller whose
 * contract is that it never does.
 */
export function writeCapabilityResolution(
  options: {
    cwd: string;
    tsconfig: string;
    version: string;
    env?: NodeJS.ProcessEnv;
  },
  answer: {
    hostInputs: readonly string[];
    manifest: string;
    projectContext: string | null;
    plugins: readonly ITtscCapabilityResolutionPlugin[];
  },
): void {
  const file = resolutionFile(options);
  if (file === null) return;
  const hostInputs = [
    ...new Set(
      answer.hostInputs
        .filter((input) => input !== "")
        .map((input) => path.resolve(input)),
    ),
  ].sort();
  if (hostInputs.length === 0) return;
  const entry: ITtscCapabilityResolutionEntry = {
    hostInputHashes: hashHostInputPaths(hostInputs),
    hostInputRealpaths: realpathHostInputPaths(hostInputs),
    hostInputs,
    manifest: answer.manifest,
    plugins: [...answer.plugins],
    projectContext: answer.projectContext,
    sources: Object.fromEntries(
      [...new Set(answer.plugins.map((plugin) => plugin.source))]
        .filter((source) => source !== "")
        .map((source) => [source, fingerprintDirectory(source)] as const),
    ),
    version: formatVersion(options.version),
  };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Written beside the target and renamed, so a reader never sees half an
    // entry: a truncated JSON parses as a failure and falls back, but a
    // partially written one could parse and be believed.
    const staging = `${file}.${String(process.pid)}.tmp`;
    fs.writeFileSync(staging, JSON.stringify(entry), "utf8");
    fs.renameSync(staging, file);
  } catch {
    return;
  }
}

function formatVersion(version: string): string {
  return `${FORMAT}:${version}`;
}

/**
 * Where the entry for this project lives, or `null` when no cache root can be
 * resolved.
 *
 * Keyed on the project rather than on the capability: the walk it replaces
 * discovers every configured plugin, so one entry answers for all of them and a
 * second consumer asking about a different capability costs nothing.
 */
function resolutionFile(options: {
  cwd: string;
  tsconfig: string;
  env?: NodeJS.ProcessEnv;
}): string | null {
  let root: string;
  try {
    root = resolveSourceBuildCachePaths(
      path.resolve(options.cwd),
      undefined,
      options.env ?? process.env,
    ).root;
  } catch {
    return null;
  }
  const key = crypto
    .createHash("sha256")
    .update(path.resolve(options.cwd))
    .update(SEPARATOR)
    .update(options.tsconfig)
    .digest("hex");
  return path.join(root, "capabilities", `${key}.json`);
}

/** Whether the parsed value has every field the validation reads. */
function isEntry(value: unknown): value is ITtscCapabilityResolutionEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<ITtscCapabilityResolutionEntry>;
  return (
    typeof entry.version === "string" &&
    Array.isArray(entry.hostInputs) &&
    entry.hostInputs.every((input) => typeof input === "string") &&
    isRecord(entry.hostInputHashes) &&
    isRecord(entry.hostInputRealpaths) &&
    isRecord(entry.sources) &&
    typeof entry.manifest === "string" &&
    (entry.projectContext === null ||
      typeof entry.projectContext === "string") &&
    Array.isArray(entry.plugins) &&
    entry.plugins.every(
      (plugin) =>
        typeof plugin === "object" &&
        plugin !== null &&
        typeof plugin.binary === "string" &&
        typeof plugin.source === "string" &&
        isRecord(plugin.capabilities),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether two snapshots describe the same state.
 *
 * Compared both ways: an input that has appeared is as much a change as one
 * that has moved, and a recorded key the fresh snapshot lacks means the two
 * were taken over different input sets.
 */
function sameMap(
  recorded: Record<string, string | null>,
  current: Record<string, string | null>,
): boolean {
  const keys = Object.keys(recorded);
  if (keys.length !== Object.keys(current).length) return false;
  return keys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(current, key) &&
      recorded[key] === current[key],
  );
}

/**
 * A directory's shape and the state of every file in it.
 *
 * Size and modification time rather than content: a plugin's Go source is
 * hundreds of files, this runs on the fast path, and the question it answers is
 * only whether the build cache would now key on something else. Bounded in
 * depth, and blind to `node_modules` and dot directories, for the same reason
 * the build that reads this source is.
 */
function fingerprintDirectory(directory: string, depth = 0): string {
  const hash = crypto.createHash("sha256");
  for (const line of directoryState(directory, depth).sort())
    hash.update(line).update("\n");
  return hash.digest("hex");
}

function directoryState(directory: string, depth: number): string[] {
  if (depth > 16) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [`${directory}${SEPARATOR}absent`];
  }
  const states: string[] = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      states.push(...directoryState(child, depth + 1));
      continue;
    }
    try {
      const stat = fs.statSync(child);
      states.push(
        [child, String(stat.size), String(stat.mtimeMs)].join(SEPARATOR),
      );
    } catch {
      states.push(`${child}${SEPARATOR}absent`);
    }
  }
  return states;
}
