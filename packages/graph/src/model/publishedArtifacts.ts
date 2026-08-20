import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type ITtscCapabilityPlugin, resolveCapabilityPlugins } from "ttsc";

import { TtscLintDaemon } from "./TtscLintDaemon";

/**
 * Ask the project's `@ttsc/lint` for the artifacts a citation can name, and
 * write them where `ttscgraph dump --artifacts` reads them.
 *
 * A project that configures no such plugin gets `file: null`, which is the
 * common case and not an error: the graph it produces is the graph it produced
 * before this existed, and the dump says so by not claiming the capability.
 *
 * ## Why this runs here and not in the compiler host
 *
 * The addresses a citation names — a Markdown anchor, `prisma:Sale.price`,
 * `POST:/orders` — are produced by parsers that live in the rule that owns
 * them, and re-deriving any of them in the graph producer would be a second
 * implementation of a published contract. So the units have to arrive from the
 * rule.
 *
 * They cannot arrive in-process. `ttscgraph` is the shipped per-platform
 * binary, never a per-project native host, so it can never have a linked
 * plugin; and `packages/lint` is its own Go module that deliberately carries no
 * requirement on the compiler host. What is left is the channel the host
 * already has: a plugin declares a capability and its sidecar answers a verb,
 * exactly as `lsp-hints` does. `resolveCapabilityPlugins` is what builds and
 * locates those sidecars, and it is the seam `ttscserver` already uses for
 * `capabilities.lsp`, published so a consumer outside the compiler can ask
 * too.
 *
 * Nothing here knows what `@ttsc/evidence` is. It asks a lint install for
 * whatever its configured rules published, and a project that configured none
 * gets an empty answer.
 */
export interface IPublishedArtifacts {
  /**
   * Path to the JSON the native producer reads, or `null` when no configured
   * plugin publishes one.
   *
   * `null` is a state rather than an absence, which is why it still carries
   * {@link inputs}. A project that adds an evidence plugin while a session is
   * running would otherwise never be reconsidered: nothing would be watched, so
   * nothing could report that the answer had changed from "none" to "some".
   */
  file: string | null;
  /**
   * Everything the answer was derived from, as paths this process can state for
   * itself.
   *
   * The artifacts describe documents the compiler's Program never read, so a
   * source edit does not move them and a document edit does not move the code
   * graph. Refreshing them is therefore a second invalidation with its own
   * inputs, and these are those inputs.
   */
  inputs: IArtifactInputs;
  /**
   * The state of {@link inputs} when the answer was produced.
   *
   * Compared against a freshly taken one to decide whether the answer is stale.
   * When it moved, nothing else in the session can tell: the compiler's own
   * invalidation watches the build universe, and none of this is in it.
   */
  fingerprint: string;
}

/** Paths an answer was derived from, split by how they are watched. */
export interface IArtifactInputs {
  /** Files stated one by one. */
  files: string[];
  /** Directories walked, which is what notices an added or deleted file. */
  directories: IArtifactDirectory[];
}

/** A directory watched on behalf of the pattern that named it. */
export interface IArtifactDirectory {
  /** Absolute path of the directory to walk. */
  path: string;
  /**
   * Whether the walk descends.
   *
   * Taken from the pattern rather than assumed, because assuming it is
   * expensive in exactly the case that looks harmless: a rule declaring `*.md`
   * has the project root for its fixed prefix, and treating that as recursive
   * would state every file in the repository before every graph request.
   */
  recursive: boolean;
}

export function publishArtifacts(options: {
  cwd: string;
  tsconfig: string;
}): IPublishedArtifacts {
  const plugins = resolveCapabilityPlugins({
    capability: "graphNodes",
    cwd: options.cwd,
    tsconfig: options.tsconfig,
  });
  if (plugins.length === 0) return unpublished(options);
  // The inputs are stated before the set is asked for, never after. A document
  // edited between the two calls has to read as a change next time, and only
  // this order gives that: a fingerprint taken first describes a state at least
  // as old as the set it labels, so the worst it can cost is one republish that
  // finds nothing new. Taken afterwards it would describe a state newer than
  // the set, and the edit that landed in the gap would read as already
  // accounted for — the exact staleness this exists to remove.
  const inputs = readInputs(
    plugins.map((plugin) => runVerb(plugin, "project-inputs", options)),
    options,
  );
  return assemble(
    options,
    inputs,
    plugins.map((plugin) => runVerb(plugin, "graph-nodes", options)),
  );
}

/**
 * The same answer, asked of sidecars this caller keeps open.
 *
 * A one-shot has nothing to amortize — its process exits after one question —
 * so `publishArtifacts` stays a spawn per verb and stays synchronous, which is
 * what its three CLI callers are. A resident session asks both verbs again
 * every time a document moves, and that is where a process, a plugin load and a
 * Program per question stopped being affordable.
 *
 * A daemon that cannot answer falls back to the direct command for that plugin,
 * so the answer is the same one either way and only its cost differs. The
 * fallback matters more here than most: a daemon that quietly answered nothing
 * would be indistinguishable from a project that publishes nothing.
 */
export async function publishArtifactsResident(
  options: { cwd: string; tsconfig: string },
  daemon: (plugin: ITtscCapabilityPlugin) => TtscLintDaemon | undefined,
): Promise<IPublishedArtifacts> {
  const plugins = resolveCapabilityPlugins({
    capability: "graphNodes",
    cwd: options.cwd,
    tsconfig: options.tsconfig,
  });
  if (plugins.length === 0) return unpublished(options);
  // The first request of a republish drops the daemon's warm Program. The
  // artifacts depend on which sources exist and what they declare — that is
  // what activates a claim — and between two republishes the developer has
  // been editing code as well as documents. Reusing a Program from before
  // those edits would deactivate a claim whose files now exist, which is a
  // stale answer of exactly the kind this whole mechanism removes. What the
  // daemon still saves is the process, the plugin load, and the configuration
  // evaluation, which is most of the cost.
  const inputs = readInputs(
    await Promise.all(
      plugins.map((plugin) =>
        askVerb(plugin, "project-inputs", options, daemon(plugin), true),
      ),
    ),
    options,
  );
  return assemble(
    options,
    inputs,
    await Promise.all(
      plugins.map((plugin) =>
        askVerb(plugin, "graph-nodes", options, daemon(plugin), false),
      ),
    ),
  );
}

/** Run one verb as its own process, returning its stdout or `null`. */
function runVerb(
  plugin: ITtscCapabilityPlugin,
  verb: string,
  options: { cwd: string; tsconfig: string },
): string | null {
  const result = spawnSync(
    plugin.binary,
    [
      verb,
      "--cwd",
      options.cwd,
      "--tsconfig",
      options.tsconfig,
      // The sidecar finds its own configured entry in this manifest. Without
      // it, it loads an empty rule configuration and answers as though the
      // project declared nothing — an empty answer indistinguishable from a
      // project that genuinely publishes none.
      `--plugins-json=${plugin.manifest}`,
      ...projectContextArgs(plugin),
    ],
    {
      // The set is one entry per document section, model field, and operation —
      // bounded by the project's own documentation, not by its source — so the
      // default pipe ceiling is raised rather than removed.
      maxBuffer: 256 * 1024 * 1024,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  // A plugin that cannot answer is not a broken graph. The verb is new, so a
  // plugin built from an older source rejects the command outright, and a
  // project whose config does not parse has already failed somewhere the user
  // can see. Either way the graph is the one that existed before this, and the
  // absent capability claim is what says the producer got no answer.
  if (result.error || result.status !== 0 || typeof result.stdout !== "string")
    return null;
  return result.stdout;
}

/** Ask one verb through a daemon, or as a process when it cannot answer. */
async function askVerb(
  plugin: ITtscCapabilityPlugin,
  verb: string,
  options: { cwd: string; tsconfig: string },
  daemon: TtscLintDaemon | undefined,
  invalidate: boolean,
): Promise<string | null> {
  const served = await daemon?.ask(verb, invalidate);
  return served ?? runVerb(plugin, verb, options);
}

/** The artifact answer, from each sidecar's `graph-nodes` output. */
function assemble(
  options: { cwd: string; tsconfig: string },
  inputs: IArtifactInputs,
  outputs: readonly (string | null)[],
): IPublishedArtifacts {
  const fingerprint = fingerprintInputs(inputs);
  const published: unknown[] = [];
  for (const output of outputs) {
    if (output === null) continue;
    try {
      const parsed: unknown = JSON.parse(output);
      if (Array.isArray(parsed)) published.push(...parsed);
    } catch {
      continue;
    }
  }
  if (published.length === 0) return { file: null, fingerprint, inputs };

  // One file per process and project, overwritten, rather than a fresh temp
  // directory per call. A directory per call is a leak nothing here is
  // positioned to clean — the path outlives this function by design, since the
  // native producer reads it after we return — and `loadGraph` is a library
  // entry a caller may run in a loop.
  //
  // Per project as well as per process, because `TtscGraphSession` is exported
  // and a consumer holding one per workspace is an ordinary thing to do. Keyed
  // on the process alone, the second session's set would overwrite the first's
  // between the moment it was written and the moment the first session's child
  // reads the path it was handed — and a graph answering with another project's
  // artifacts is exactly the silently-wrong answer this channel exists to make
  // impossible.
  const file = path.join(
    os.tmpdir(),
    `ttsc-graph-artifacts-${String(process.pid)}-${projectKey(options)}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(published));
  return { file, fingerprint, inputs };
}

/**
 * Whether the inputs an answer was derived from have moved since.
 *
 * Answered by stating paths this process already knows, not by asking the
 * plugin again. The question is asked before every graph request in a resident
 * session, and re-running plugin discovery per request would cost more than the
 * refresh it guards — while a `stat` per document costs less than reading one
 * of them.
 *
 * The cost of being wrong in the cheap direction is what makes this worth
 * paying at all: a developer who edited only a spec section, and nothing the
 * compiler reads, otherwise saw the graph keep answering with the headings that
 * section used to have.
 */
export function artifactsAreStale(published: IPublishedArtifacts): boolean {
  // The written set is one of its own inputs, by existence alone. It lives in
  // the system temp directory, which is swept on a schedule this session has no
  // say in, and the server is handed the path on every request — so once it is
  // gone every later request fails as a broken exchange, and the only cure is
  // restarting the editor. That is the outcome `unpublished` exists to avoid,
  // and it would be odd to accept it here.
  //
  // Existence and nothing else. The file is written after this answer's
  // fingerprint was taken, so folding its size or time into that state would
  // report stale forever.
  if (published.file !== null && !fs.existsSync(published.file)) return true;
  return fingerprintInputs(published.inputs) !== published.fingerprint;
}

/**
 * The answer for a project that publishes nothing, and what to watch so that
 * answer can change.
 *
 * Configuring a plugin means editing the project's tsconfig or installing a
 * package that declares one, so those two files are what could turn this answer
 * into a different one. They are stated rather than the whole discovery being
 * re-run, because re-running it walks the dependency closure — the cost
 * samchon/ttsc#1276 is about — and paying that per request to learn nothing
 * would be worse than the staleness it prevents.
 *
 * Bounded, and deliberately: a tsconfig that inherits its plugins from an
 * extended config is not tracked here, because naming the whole extends chain
 * means asking the loader that is itself the expense.
 */
function unpublished(options: {
  cwd: string;
  tsconfig: string;
}): IPublishedArtifacts {
  const inputs: IArtifactInputs = {
    directories: [],
    files: [
      path.resolve(options.cwd, options.tsconfig),
      path.resolve(options.cwd, "package.json"),
    ],
  };
  return { file: null, fingerprint: fingerprintInputs(inputs), inputs };
}

/**
 * What each sidecar said its rules read, as one watch list.
 *
 * The `project-inputs` verb exists for exactly this question: `@ttsc/lint`
 * publishes it so a host can learn that a rule depends on files the Program
 * never loads. Its snapshot carries both halves of what is needed here — the
 * plugin's own configuration files, and the globs the rules declared — so a
 * configuration edit and a document edit are noticed by the same state rather
 * than by two mechanisms that could disagree.
 */
function readInputs(
  outputs: readonly (string | null)[],
  options: { cwd: string; tsconfig: string },
): IArtifactInputs {
  const files: string[] = [];
  const directories: IArtifactDirectory[] = [];
  for (const output of outputs) {
    if (output === null) continue;
    let snapshot: {
      root?: string;
      files?: string[];
      globs?: string[];
      reloadFiles?: string[];
      reloadDirectories?: string[];
    };
    try {
      snapshot = JSON.parse(output) as typeof snapshot;
    } catch {
      continue;
    }
    // The snapshot names the base its own paths are relative to. It normalizes
    // them to absolute today, so this changes nothing now and is what keeps a
    // relative answer from being resolved against the wrong directory later —
    // silently, since a path that does not exist states itself absent and reads
    // as a project whose documents were all deleted.
    const base = snapshot.root ?? options.cwd;
    for (const file of [
      ...(snapshot.files ?? []),
      ...(snapshot.reloadFiles ?? []),
    ])
      files.push(absolute(file, base));
    for (const pattern of snapshot.globs ?? []) {
      const directory = watchedBy(pattern, base);
      if (directory === null) files.push(absolute(pattern, base));
      else directories.push(directory);
    }
    // A reload directory is a resolution anchor, not a content tree.
    // `@ttsc/lint` publishes the directories whose *immediate* topology decides
    // which rules load — a `node_modules` chain, a config directory — and the
    // LSP host watches exactly `<dir>/*` for that reason. Walking them
    // recursively both over-invalidates, restarting on any descendant edit, and
    // states the whole dependency tree before every graph request.
    for (const directory of snapshot.reloadDirectories ?? [])
      directories.push({ path: absolute(directory, base), recursive: false });
  }
  // A directory named twice is walked once, and a recursive claim wins: two
  // patterns over one tree, one descending and one not, must not leave the
  // descending one's files unwatched because the other was seen first.
  const merged = new Map<string, boolean>();
  for (const directory of directories)
    merged.set(
      directory.path,
      (merged.get(directory.path) ?? false) || directory.recursive,
    );
  return {
    directories: [...merged]
      .map(([directory, recursive]) => ({ path: directory, recursive }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    files: [...new Set(files)].sort(),
  };
}

/**
 * The directory a declared pattern makes worth walking, or `null` when the
 * pattern names one path and should simply be stated.
 *
 * Two readings have to be right here, and both are cheap to get wrong. A
 * pattern carrying no wildcard is a path, not a tree: watching its parent
 * instead would state every sibling on every request to learn about the one
 * file that was declared. And a pattern that does not say `**` does not descend
 * — treating it as though it did is unbounded in exactly the case that looks
 * harmless, because a bare `*.md` has the project root for its prefix.
 */
export function watchedBy(
  pattern: string,
  cwd: string,
): IArtifactDirectory | null {
  if (pattern.search(GLOB_MAGIC) < 0) return null;
  return { path: globRoot(pattern, cwd), recursive: pattern.includes("**") };
}

/**
 * The project identity flag, for a plugin whose descriptor asks for one.
 *
 * A rule resolves its own inputs — the documents a claim reads, a schema, an
 * OpenAPI file — against the project root, and a sidecar is handed that root
 * rather than deriving it. Without the flag the rule has no base, and it
 * answers with an empty set rather than an error, because "this project
 * declares nothing" is a legitimate answer it cannot tell apart from "nobody
 * told me where the project is". That is why every verb here passes it and why
 * the case covering this drives a real project: an empty answer is exactly what
 * a synthetic fixture would also have produced.
 */
function projectContextArgs(plugin: {
  projectContext?: string;
}): readonly string[] {
  return plugin.projectContext === undefined
    ? []
    : [`--project-context-json=${plugin.projectContext}`];
}

/**
 * The project a published set belongs to, as a filename-safe tag.
 *
 * Short rather than the whole digest: it distinguishes the projects one process
 * drives, which is a handful, and the process id beside it already separates
 * two runs.
 */
function projectKey(options: { cwd: string; tsconfig: string }): string {
  return createHash("sha256")
    .update(path.resolve(options.cwd))
    .update(SEPARATOR)
    .update(options.tsconfig)
    .digest("hex")
    .slice(0, 16);
}

/** Wildcards a pattern may use; a pattern with none of them names one path. */
const GLOB_MAGIC = /[*?[{]/u;

/** A declared path resolved against the project root. */
function absolute(target: string, cwd: string): string {
  return path.isAbsolute(target) ? target : path.join(cwd, target);
}

/**
 * The state of every input, as one comparable string.
 *
 * Files are stated by size and modification time rather than content: this runs
 * before every graph request, and hashing a documentation corpus per request
 * would cost more than the refresh it guards. Directories are walked for the
 * same pair, which is what notices a section added or a document deleted rather
 * than edited.
 */
export function fingerprintInputs(inputs: IArtifactInputs): string {
  const parts: string[] = [];
  for (const file of inputs.files) parts.push(stateOf(file));
  for (const directory of inputs.directories)
    parts.push(...walkState(directory.path, directory.recursive));
  parts.sort();
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/**
 * A path's size and modification time, or a marker when it is absent.
 *
 * The fields are joined on a character a path cannot contain. Separated by a
 * space, a file literally named `a 1 2` states the same string as a one-byte
 * file named `a`, and an edit to either would then read as no edit at all.
 */
function stateOf(file: string): string {
  try {
    const stat = fs.statSync(file);
    return [file, String(stat.size), String(stat.mtimeMs)].join(SEPARATOR);
  } catch {
    return [file, "absent"].join(SEPARATOR);
  }
}

/**
 * The character that joins fields a path could otherwise forge.
 *
 * Built rather than written literally: a source file carrying a raw NUL is one
 * Git classifies as binary, which exempts it from this repository's end-of-line
 * contract and leaves it with no textual diff for a reviewer.
 */
const SEPARATOR = String.fromCharCode(0);

/**
 * The fixed directory prefix of a glob, which is what there is to walk.
 *
 * A pattern with no directory part at all names the project root, which is the
 * one reading that keeps a bare `*.md` from being walked as though it were a
 * directory named `*.md`.
 */
function globRoot(pattern: string, cwd: string): string {
  const magic = pattern.search(GLOB_MAGIC);
  const head = magic < 0 ? pattern : pattern.slice(0, magic);
  const slash = Math.max(head.lastIndexOf("/"), head.lastIndexOf("\\"));
  const root = slash < 0 ? "" : head.slice(0, slash);
  return root === "" ? cwd : absolute(root, cwd);
}

/**
 * Every entry below `directory`, stated.
 *
 * Bounded three ways, because this runs before every graph request: it descends
 * only when the pattern that named the directory descends, it never enters
 * `node_modules`, and it stops at a depth no documentation tree reaches. Dotted
 * directories are skipped below the declared root, which is what the glob that
 * named it would have matched anyway.
 *
 * A directory that does not exist states itself absent, which is what notices
 * one being created.
 */
function walkState(directory: string, recursive: boolean, depth = 0): string[] {
  if (depth > 12) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [stateOf(directory)];
  }
  const states: string[] = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!recursive) continue;
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      states.push(...walkState(child, recursive, depth + 1));
      continue;
    }
    states.push(stateOf(child));
  }
  return states;
}
