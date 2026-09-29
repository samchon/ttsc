import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  type ITtscCapabilityPlugin,
  type ITtscCapabilityPluginResolution,
  resolveCapabilityPluginResolution,
} from "ttsc";

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
 * exactly as `lsp-hints` does. `resolveCapabilityPluginResolution` builds and
 * locates those sidecars, and it is the seam `ttscserver` already uses for
 * `capabilities.lsp`, published so a consumer outside the compiler can ask
 * too.
 *
 * Nothing here knows what `@ttsc/evidence` is. It asks a lint install for
 * whatever its configured rules published, and a project that configured none
 * gets an empty answer.
 *
 * @evidence contracts/common.md#principled-implementation Publication carries the sidecar's artifact file and the input identity captured before asking for artifacts, so later input changes can invalidate that answer.
 * @evidence contracts/common.md#clear-and-simple-design The result separates the producer exchange path, input inventory and freshness identity without embedding compiler Program state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A null file states an absent publication, not an invented artifact set or a successful compiler capability claim.
 * @evidence contracts/common.md#meaningful-documentation Native member prose explains publication absence, independent document inputs and the fingerprint's ordering role.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This result shape chooses no publication or fingerprint algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The session and freshness predicate decide continued publication reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The publisher/session own exchange storage; the DTO transfers its path and witnesses.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This result describes a path; publisher assembly and freshness helpers own native filesystem access.
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

  /**
   * Owning plugin discovery proof, including successful absence. Omitted by
   * legacy callers, whose publication cannot establish discovery freshness.
   */
  discovery?: ITtscCapabilityPluginResolution;
}

/**
 * Paths an answer was derived from, split by how they are watched.
 *
 * @evidence contracts/common.md#principled-implementation Explicit files and watched directories represent edits and membership changes as distinct input populations.
 * @evidence contracts/common.md#clear-and-simple-design Two lists carry sidecar-declared provenance without a second glob interpreter or compiler dependency model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An input inventory does not assert complete discovery provenance for a missing publisher.
 * @evidence contracts/common.md#meaningful-documentation Native property prose identifies individual files and directories that notice additions and deletions.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The inventory declares input populations; fingerprintInputs chooses their processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The inventory itself does not validate or coordinate publication reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The publisher/session own inventory lifetime rather than this data shape.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Inventory paths are consumed by fingerprintInputs; this shape does not resolve or access them.
 */
export interface IArtifactInputs {
  /** Files stated one by one. */
  files: string[];

  /** Directories walked, which is what notices an added or deleted file. */
  directories: IArtifactDirectory[];
}

/**
 * A directory watched on behalf of the pattern that named it.
 *
 * @evidence contracts/common.md#principled-implementation The absolute root and descent flag identify the conservative tree population needed to notice a declared pattern changing.
 * @evidence contracts/common.md#clear-and-simple-design A directory watch contains only its native root and traversal choice; resolved files remain in the separate file list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The depth decision follows wildcard path structure rather than an arbitrary maximum documentation depth.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the recursive distinction and why a bare filename wildcard does not require a repository-wide scan.
 * @evidenceExclude contracts/performance.md#efficient-algorithms watchedBy and fingerprintInputs own the selection and traversal that consume this descriptor.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This directory value coordinates no completed or in-flight work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The descriptor owns no directory handle or retained task.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The directory coordinate is a value; selection and fingerprinting own its native resolution and access.
 */
export interface IArtifactDirectory {
  /** Absolute path of the directory to walk. */
  path: string;

  /**
   * Whether the walk descends.
   *
   * Taken from wildcard path structure rather than assumed, because assuming it
   * is expensive in exactly the case that looks harmless: a rule declaring
   * `*.md` has the project root for its fixed prefix, and treating that as
   * recursive would state every file in the repository before every graph
   * request.
   */
  recursive: boolean;
}

/**
 * Discover configured publishers and synchronously publish their artifact set.
 * Input identity is captured before the graph-nodes verbs to avoid accepting a
 * concurrent document edit as already represented by an older answer.
 *
 * @evidence contracts/common.md#principled-implementation Capability discovery and each sidecar's project-inputs/graph-nodes verbs remain the authorities for plugin selection and artifact meaning.
 * @evidence contracts/common.md#clear-and-simple-design The one-shot path composes discovery, input capture and publication through helpers also used by resident requests.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable sidecars do not produce fabricated artifacts; no evidence-rule-specific parser or private compiler mutation substitutes for the publisher.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents synchronous ownership and the freshness snapshot's required ordering.
 * @evidence contracts/performance.md#efficient-algorithms Discovery runs once per publication, distinct input paths are merged and fingerprinted once, and publisher JSON is concatenated in one pass.
 * @evidence contracts/performance.md#reuse-equivalent-work This one-shot caller has no resident sidecar owner; resident consumers use publishArtifactsResident and session freshness reuse instead of repeatedly spawning this path.
 * @evidence contracts/performance.md#bound-retention-and-release-resources SpawnSync owns each child through completion; the exchange file is overwritten per process/project, but historical project files have no explicit reclamation yet.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths and temporary storage use Node path/os APIs; sidecars receive argument arrays and hidden Windows child windows without shell composition.
 */
export function publishArtifacts(options: {
  cwd: string;
  tsconfig: string;
}): IPublishedArtifacts {
  const discovery = resolveCapabilityPluginResolution({
    capability: "graphNodes",
    cwd: options.cwd,
    tsconfig: options.tsconfig,
  });
  const plugins = discovery.plugins;
  if (plugins.length === 0) return unpublished(options, discovery);
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
  const fingerprint = fingerprintInputs(inputs);
  return assemble(
    options,
    inputs,
    fingerprint,
    plugins.map((plugin) => runVerb(plugin, "graph-nodes", options)),
    discovery,
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
 *
 * @evidence contracts/common.md#principled-implementation Both paths ask the same configured sidecar verbs; input identity is captured before publication and invalidation clears the daemon's stale Program first.
 * @evidence contracts/common.md#clear-and-simple-design The caller supplies sidecar ownership while this function owns ordered input and artifact phases and the shared result assembly.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed daemon falls back to the public direct verb, not an invented empty-success result or a reimplementation of its parser.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains resident reuse, direct-command fallback and the reason to invalidate the Program before input collection.
 * @evidence contracts/performance.md#efficient-algorithms Independent publishers run concurrently within each of two ordered phases; deduplication avoids repeatedly hashing the same declared file path.
 * @evidence contracts/performance.md#reuse-equivalent-work Session-owned daemons reuse process and plugin loading only while binary, manifest and project context match; changed inputs rebuild the publication.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The session owns and closes daemons; this operation owns temporary outputs until assembly, with one exchange file per process/project and no historical-file reclamation.
 * @evidence contracts/portability.md#os-neutral-implementation The fallback preserves native argument-vector invocation and Node path resolution; daemon ownership uses the same cross-platform process boundary.
 */
export async function publishArtifactsResident(
  options: { cwd: string; tsconfig: string },
  daemon: (plugin: ITtscCapabilityPlugin) => TtscLintDaemon | undefined,
): Promise<IPublishedArtifacts> {
  const discovery = resolveCapabilityPluginResolution({
    capability: "graphNodes",
    cwd: options.cwd,
    tsconfig: options.tsconfig,
  });
  const plugins = discovery.plugins;
  if (plugins.length === 0) return unpublished(options, discovery);
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
  const fingerprint = fingerprintInputs(inputs);
  return assemble(
    options,
    inputs,
    fingerprint,
    await Promise.all(
      plugins.map((plugin) =>
        askVerb(plugin, "graph-nodes", options, daemon(plugin), false),
      ),
    ),
    discovery,
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
  fingerprint: string,
  outputs: readonly (string | null)[],
  discovery: ITtscCapabilityPluginResolution,
): IPublishedArtifacts {
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
  if (published.length === 0)
    return { file: null, fingerprint, inputs, discovery };

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
  return { file, fingerprint, inputs, discovery };
}

/**
 * Whether the inputs an answer was derived from have moved since.
 *
 * Published documents are compared by content identity. The owning resolver
 * separately qualifies discovery, including successful absence. Unavailable,
 * incomplete or changed discovery proof requires another lookup.
 *
 * @evidence contracts/common.md#principled-implementation The owning discovery query must still qualify this exact lookup, and exchange-file existence plus declared input identity must also hold before any publication or successful absence is reused.
 * @evidence contracts/common.md#clear-and-simple-design Discovery freshness stays with the resolver and downstream document identity stays with fingerprintInputs; this predicate combines their independent authority.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Equal size and modification time cannot substitute for file-content equivalence, and a partial no-plugin watch list cannot prove discovery stability.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain content-based publication freshness, successful absence and conservative relookup for incomplete discovery proof.
 * @evidence contracts/performance.md#efficient-algorithms Freshness hashes the distinct declared inputs and traverses watch roots once per inventory entry; its cost grows with watched bytes and entries rather than only stat count.
 * @evidence contracts/performance.md#reuse-equivalent-work The resolver's original complete discovery proof authorizes sharing populated or empty results; changed or unproved selection requires relookup, and document fingerprints separately qualify overlay reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This predicate borrows an inventory and returns a boolean; the publication and session own their storage and sidecars.
 * @evidence contracts/portability.md#os-neutral-implementation Existence and fingerprints use Node filesystem APIs and native absolute paths without assumptions about platform shell commands.
 */
export function artifactsAreStale(published: IPublishedArtifacts): boolean {
  // Discovery remains the loader's authority, including successful absence.
  // A downstream input list cannot replace an unavailable or incomplete proof.
  if (
    published.discovery?.status !== "resolved" ||
    !published.discovery.isCurrent()
  )
    return true;
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
 * The direct config and package manifest are useful provenance, but do not
 * cover inherited configuration or dependency installation. The attached owning
 * discovery proof supplies that independent authority; direct paths do not
 * stand in for it.
 */
function unpublished(
  options: { cwd: string; tsconfig: string },
  discovery: ITtscCapabilityPluginResolution,
): IPublishedArtifacts {
  const inputs: IArtifactInputs = {
    directories: [],
    files: [
      path.resolve(options.cwd, options.tsconfig),
      path.resolve(options.cwd, "package.json"),
    ],
  };
  return {
    file: null,
    fingerprint: fingerprintInputs(inputs),
    inputs,
    discovery,
  };
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
 * file that was declared. A bare filename wildcard stays shallow; globstar or a
 * wildcard directory component requires descent from the fixed prefix.
 *
 * @evidence contracts/common.md#principled-implementation Literal paths remain individual inputs; wildcard paths use their fixed directory prefix and descend when remaining path components can contain matched files.
 * @evidence contracts/common.md#clear-and-simple-design A single fixed-prefix calculation and descent decision produce the directory descriptor consumed by fingerprinting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Descent is not inferred solely from globstar, which would miss wildcard directory components followed by a filename.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents literal paths, bare wildcards and wildcard-directory descent.
 * @evidence contracts/performance.md#efficient-algorithms Pattern scanning is linear in pattern length and avoids directory traversal at selection time; a bare filename wildcard keeps the walk shallow.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure descriptor calculation has no cross-request producer or validation coordinator; publication owns reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned descriptor transfers to its caller and owns no handle or retained task.
 * @evidence contracts/portability.md#os-neutral-implementation Both slash forms are recognized at the native-path boundary and relative roots resolve through Node path APIs.
 */
export function watchedBy(
  pattern: string,
  cwd: string,
): IArtifactDirectory | null {
  if (pattern.search(GLOB_MAGIC) < 0) return null;
  const magic = pattern.search(GLOB_MAGIC);
  return {
    path: globRoot(pattern, cwd),
    recursive: pattern.includes("**") || /[/\\]/u.test(pattern.slice(magic)),
  };
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
 * Files are hashed by content so same-size edits with restored modification
 * times remain observable. Directory membership is walked conservatively from
 * declared roots; matching remains the sidecar's responsibility.
 *
 * @evidence contracts/common.md#principled-implementation The fingerprint includes input paths and regular-file bytes; sorted records make enumeration order irrelevant while missing paths retain an explicit marker.
 * @evidence contracts/common.md#clear-and-simple-design File state and conservative directory traversal share one record representation before the final digest.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Metadata equality, hidden-directory skipping and arbitrary depth limits do not stand in for declared input identity.
 * @evidence contracts/common.md#meaningful-documentation Native prose states content hashing, conservative membership and sidecar ownership of actual matching.
 * @evidence contracts/performance.md#efficient-algorithms Cost is linear in watched regular-file bytes plus O(N log N) record sorting; broad recursive globs conservatively over-read and may invalidate unrelated edits.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This computes one validation identity; the session compares it with the publication snapshot and decides reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous reads close their descriptors internally, and the record array exists only for this computation; no historical fingerprint state is retained here.
 * @evidence contracts/portability.md#os-neutral-implementation Native stat, read and directory APIs handle platform paths; NUL-separated fields prevent filename ambiguity without shell serialization.
 */
export function fingerprintInputs(inputs: IArtifactInputs): string {
  const parts: string[] = [];
  const states = new Map<string, string>();
  for (const file of inputs.files) parts.push(stateOf(file, states));
  for (const directory of inputs.directories)
    parts.push(...walkState(directory.path, directory.recursive, states));
  parts.sort();
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/**
 * A regular file's content identity, physical directory identity, or absence.
 *
 * The fields are joined on a character a path cannot contain. Separated by a
 * space, a file literally named `a 1 2` states the same string as a one-byte
 * file named `a`, and an edit to either would then read as no edit at all.
 */
function stateOf(file: string, states: Map<string, string>): string {
  const existing = states.get(file);
  if (existing !== undefined) return existing;
  try {
    const stat = fs.statSync(file);
    const identity = stat.isFile()
      ? createHash("sha256").update(fs.readFileSync(file)).digest("hex")
      : stat.isDirectory()
        ? ["directory", fs.realpathSync.native(file)].join(SEPARATOR)
        : ["other", String(stat.size), String(stat.mtimeMs)].join(SEPARATOR);
    const state = [file, identity].join(SEPARATOR);
    states.set(file, state);
    return state;
  } catch (error) {
    if (!missingPath(error)) throw error;
    const state = [file, "absent"].join(SEPARATOR);
    states.set(file, state);
    return state;
  }
}

/** Missing paths are inputs; unreadable existing inputs are failures. */
function missingPath(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
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
 * Descent follows the declared pattern rather than a guessed maximum depth or
 * excluded directory name. Symlink directories are followed with a physical
 * ancestor set so their declared contents are watched without creating cycles.
 *
 * A directory that does not exist states itself absent, which is what notices
 * one being created.
 */
function walkState(
  directory: string,
  recursive: boolean,
  inputStates: Map<string, string>,
  ancestors: ReadonlySet<string> = new Set(),
): string[] {
  let entries: fs.Dirent[];
  let physical: string;
  try {
    physical = fs.realpathSync.native(directory);
    if (ancestors.has(physical)) return [stateOf(directory, inputStates)];
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (!missingPath(error)) throw error;
    return [stateOf(directory, inputStates)];
  }
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(physical);
  const states: string[] = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    let directoryEntry = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        directoryEntry = fs.statSync(child).isDirectory();
      } catch (error) {
        if (!missingPath(error)) throw error;
      }
    }
    if (directoryEntry) {
      if (!recursive) {
        states.push(stateOf(child, inputStates));
        continue;
      }
      states.push(...walkState(child, recursive, inputStates, nextAncestors));
      continue;
    }
    states.push(stateOf(child, inputStates));
  }
  return states;
}
