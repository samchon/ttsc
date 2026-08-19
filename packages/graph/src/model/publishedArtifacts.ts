import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveCapabilityPlugins } from "ttsc";

/**
 * Ask the project's `@ttsc/lint` for the artifacts a citation can name, and
 * write them where `ttscgraph dump --artifacts` reads them.
 *
 * Returns the file's path, or `null` when no configured plugin declares the
 * capability or none answered. A project without one is the common case and is
 * not an error: the graph it produces is the graph it produced before this
 * existed, and the dump says so by not claiming the capability.
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
  /** Path to the JSON the native producer reads. */
  file: string;
  /**
   * Everything the published set was derived from, as paths this process can
   * stat for itself.
   *
   * The artifacts describe documents the compiler's Program never read, so a
   * source edit does not move them and a document edit does not move the code
   * graph. Refreshing them is therefore a second invalidation with its own
   * inputs, and these are those inputs: the plugin's own configuration files
   * and the document trees its rules declared they read.
   */
  inputs: IArtifactInputs;
  /**
   * The state of {@link inputs} when the set was published.
   *
   * Compared against a freshly taken one to decide whether the set is stale.
   * When it moved, nothing else in the session can tell: the compiler's own
   * invalidation watches the build universe, and none of this is in it.
   */
  fingerprint: string;
}

/** Paths a published set was derived from, split by how they are watched. */
export interface IArtifactInputs {
  /** Files stated one by one. */
  files: string[];
  /** Directory trees walked, which is what notices an added or deleted file. */
  directories: string[];
}

export function publishArtifacts(options: {
  cwd: string;
  tsconfig: string;
}): IPublishedArtifacts | null {
  const plugins = resolveCapabilityPlugins({
    capability: "graphNodes",
    cwd: options.cwd,
    tsconfig: options.tsconfig,
  });
  if (plugins.length === 0) return null;

  const published: unknown[] = [];
  for (const plugin of plugins) {
    const result = spawnSync(
      plugin.binary,
      [
        "graph-nodes",
        "--cwd",
        options.cwd,
        "--tsconfig",
        options.tsconfig,
        // The sidecar finds its own configured entry in this manifest. Without
        // it, it loads an empty rule configuration and answers as though the
        // project declared nothing — an empty answer indistinguishable from a
        // project that genuinely publishes none.
        `--plugins-json=${plugin.manifest}`,
      ],
      {
        // The set is one entry per document section, model field, and operation
        // — bounded by the project's own documentation, not by its source — so
        // the default pipe ceiling is raised rather than removed.
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
    if (
      result.error ||
      result.status !== 0 ||
      typeof result.stdout !== "string"
    )
      continue;
    try {
      const parsed: unknown = JSON.parse(result.stdout);
      if (Array.isArray(parsed)) published.push(...parsed);
    } catch {
      continue;
    }
  }
  if (published.length === 0) return null;

  // One file per process, overwritten, rather than a fresh temp directory per
  // call. A resident session asks once and a one-shot asks once, but `loadGraph`
  // is a library entry a caller may run in a loop, and a directory per call is a
  // leak nothing here is positioned to clean: the path outlives this function by
  // design — the native producer reads it after we return.
  const file = path.join(
    os.tmpdir(),
    `ttsc-graph-artifacts-${String(process.pid)}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(published));
  const inputs = artifactInputs(plugins, options);
  return { file, fingerprint: fingerprintInputs(inputs), inputs };
}

/**
 * Whether the inputs a published set was derived from have moved since.
 *
 * Answered by stating paths this process already knows, not by asking the
 * plugin again. The question is asked before every graph request in a resident
 * session, and a sidecar spawn per request would cost more than the refresh it
 * guards — while a `stat` per document costs less than reading one of them.
 *
 * The cost of being wrong in the cheap direction is what makes this worth
 * paying at all: a developer who edited only a spec section, and nothing the
 * compiler reads, otherwise saw the graph keep answering with the headings that
 * section used to have.
 */
export function artifactsAreStale(published: IPublishedArtifacts): boolean {
  return fingerprintInputs(published.inputs) !== published.fingerprint;
}

/**
 * Ask the sidecars which paths their rules read.
 *
 * Through the `project-inputs` verb that already exists for this exact
 * question: `@ttsc/lint` publishes it so a host can learn that a rule depends on
 * files the Program never loads. Its snapshot carries both halves of what is
 * needed here — the plugin's own configuration files, and the globs the rules
 * declared — so a configuration edit and a document edit are noticed by the
 * same state rather than by two mechanisms that could disagree.
 */
function artifactInputs(
  plugins: readonly { binary: string; manifest: string }[],
  options: { cwd: string; tsconfig: string },
): IArtifactInputs {
  const files: string[] = [];
  const directories: string[] = [];
  for (const plugin of plugins) {
    const result = spawnSync(
      plugin.binary,
      [
        "project-inputs",
        "--cwd",
        options.cwd,
        "--tsconfig",
        options.tsconfig,
        `--plugins-json=${plugin.manifest}`,
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true },
    );
    if (result.status !== 0 || typeof result.stdout !== "string") continue;
    let snapshot: {
      files?: string[];
      globs?: string[];
      reloadFiles?: string[];
      reloadDirectories?: string[];
    };
    try {
      snapshot = JSON.parse(result.stdout) as typeof snapshot;
    } catch {
      continue;
    }
    files.push(...(snapshot.files ?? []), ...(snapshot.reloadFiles ?? []));
    for (const pattern of [
      ...(snapshot.globs ?? []),
      ...(snapshot.reloadDirectories ?? []),
    ])
      directories.push(globRoot(pattern, options.cwd));
  }
  return {
    files: [...new Set(files)].sort(),
    directories: [...new Set(directories)].sort(),
  };
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
    parts.push(...walkState(directory));
  parts.sort();
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/** A path's size and modification time, or a marker when it is absent. */
function stateOf(file: string): string {
  try {
    const stat = fs.statSync(file);
    return `${file} ${String(stat.size)} ${String(stat.mtimeMs)}`;
  } catch {
    return `${file} absent`;
  }
}

/**
 * The fixed directory prefix of a glob, which is what there is to walk.
 *
 * A pattern with no directory part at all names the project root, which is the
 * one reading that keeps a bare `*.md` from being walked as though it were a
 * directory named `*.md`.
 */
function globRoot(pattern: string, cwd: string): string {
  const magic = pattern.search(/[*?[{]/u);
  const head = magic < 0 ? pattern : pattern.slice(0, magic);
  const slash = Math.max(head.lastIndexOf("/"), head.lastIndexOf("\\"));
  const root = slash < 0 ? "" : head.slice(0, slash);
  if (root === "") return cwd;
  return path.isAbsolute(root) ? root : path.join(cwd, root);
}

/**
 * Every entry below `directory`, stated.
 *
 * Bounded rather than unbounded: a glob root is a documentation directory, not
 * a repository, and a walk that wandered into `node_modules` would cost more
 * per request than the whole graph. A directory that does not exist states
 * itself absent, which is what notices one being created.
 */
function walkState(directory: string, depth = 0): string[] {
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
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      states.push(...walkState(child, depth + 1));
      continue;
    }
    states.push(stateOf(child));
  }
  return states;
}
