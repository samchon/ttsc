import fs from "node:fs";
import path from "node:path";

import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";

/**
 * Which symbols a project puts on the wire, and through which door.
 *
 * A package.json is the only place a package says what its public API is: the
 * `exports` map names one entry file for `.` and one for each subpath, and the
 * graph says what each of those files exports. Put together they answer the
 * question a tour question opens with — start at the public API — with facts
 * instead of a filename guess.
 *
 * The distinction the ranker needs is the front door versus the rest. zod
 * exports its current implementation from `.` and keeps the previous major
 * behind `./v3`; both are exported, both are public, and only the `exports` map
 * says which one a caller reaches by importing the package. Ranked on name
 * match and an `exported` flag alone, the legacy surface wins whenever its
 * names are the ones the question used — which is what happened, and what sent
 * the model into the files to find out which implementation was current.
 *
 * A project with no package.json entry that resolves to source — an
 * application, a repository whose entries point at built output — gets an empty
 * result, and the callers fall back to what they did before.
 */
export interface IPublicApi {
  /** True when at least one package.json entry resolved to a source module. */
  readonly known: boolean;
  /** Symbol ids the packages' `.` entries export. */
  readonly front: ReadonlySet<string>;
  /** Symbol ids exported only through a subpath entry (`./v3`, `./mini`). */
  readonly subpath: ReadonlySet<string>;
  /** The `.` entry files themselves, project-relative. */
  readonly entries: readonly string[];
}

const EMPTY: IPublicApi = {
  known: false,
  front: new Set(),
  subpath: new Set(),
  entries: [],
};

const cache = new WeakMap<TtscGraphMemory, IPublicApi>();

/** The project's public API, resolved once per resident graph. */
export function publicApiOf(graph: TtscGraphMemory): IPublicApi {
  const hit = cache.get(graph);
  if (hit !== undefined) return hit;
  const resolved = resolve(graph);
  cache.set(graph, resolved);
  return resolved;
}

/**
 * The rank a node's export surface earns it: 2 for a symbol the package's front
 * door exports, 1 for one reachable only through a subpath entry, 0 for the
 * rest. It is 0 for every node when no entry resolved, so a project the
 * package.json cannot speak for is ranked exactly as it was before.
 */
export function publicApiRank(graph: TtscGraphMemory, id: string): number {
  const api = publicApiOf(graph);
  if (!api.known) return 0;
  if (api.front.has(id)) return 2;
  if (api.subpath.has(id)) return 1;
  return 0;
}

function resolve(graph: TtscGraphMemory): IPublicApi {
  const root = graph.project;
  if (root === "" || !path.isAbsolute(root)) return EMPTY;
  const front = new Set<string>();
  const subpath = new Set<string>();
  const entries: string[] = [];
  for (const [dir, manifest] of manifests(graph, root)) {
    for (const entry of entryFiles(manifest)) {
      const file = relativeSourceFile(dir, entry.target);
      if (file === undefined) continue;
      const node = graph.node(file);
      if (node === undefined || node.kind !== "file") continue;
      const exported = exportsOf(graph, node);
      if (exported.length === 0) continue;
      if (entry.root) {
        entries.push(file);
        for (const id of exported) front.add(id);
      } else {
        for (const id of exported) subpath.add(id);
      }
    }
  }
  for (const id of front) subpath.delete(id);
  const known = front.size > 0 || subpath.size > 0;
  return known ? { known, front, subpath, entries } : EMPTY;
}

/** The symbols a module puts on the wire, from the checker's export table. */
function exportsOf(graph: TtscGraphMemory, file: ITtscGraphNode): string[] {
  return graph
    .outgoing(file.id)
    .filter((edge) => edge.kind === "exports")
    .map((edge) => edge.to);
}

/**
 * Every package.json that owns a file in the graph, keyed by its directory. A
 * monorepo has one per workspace package, and each speaks only for its own
 * files, so the walk starts at the directories the graph actually holds and
 * climbs to the project root.
 */
function manifests(
  graph: TtscGraphMemory,
  root: string,
): Map<string, Record<string, unknown>> {
  const found = new Map<string, Record<string, unknown>>();
  const visited = new Set<string>();
  const dirs = new Set<string>();
  for (const node of graph.nodes) {
    if (node.kind !== "file" || node.external) continue;
    const slash = node.file.lastIndexOf("/");
    dirs.add(slash >= 0 ? node.file.slice(0, slash) : "");
  }
  for (const start of dirs) {
    let dir = start;
    for (;;) {
      if (visited.has(dir)) break;
      visited.add(dir);
      const manifest = readManifest(path.join(root, dir, "package.json"));
      if (manifest !== undefined) found.set(dir, manifest);
      if (dir === "") break;
      const slash = dir.lastIndexOf("/");
      dir = slash >= 0 ? dir.slice(0, slash) : "";
    }
  }
  return found;
}

function readManifest(file: string): Record<string, unknown> | undefined {
  try {
    const text = fs.readFileSync(file, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

interface IEntry {
  /** True for the package's own name (`.`), false for a subpath. */
  readonly root: boolean;
  /** The path the manifest points at, relative to the package directory. */
  readonly target: string;
}

/**
 * The entry targets a manifest names. Every string in an `exports` subtree is a
 * candidate, whatever condition it sits under: a source condition
 * (`"@zod/source": "./src/index.ts"`) is what a workspace build resolves to,
 * and the non-source conditions point at built output that no source file will
 * match anyway. `main`, `module`, and `types` are the pre-`exports` spelling of
 * `.`.
 */
function entryFiles(manifest: Record<string, unknown>): IEntry[] {
  const out: IEntry[] = [];
  for (const field of ["main", "module", "types", "typings"]) {
    const value = manifest[field];
    if (typeof value === "string") out.push({ root: true, target: value });
  }
  const exportsField = manifest.exports;
  if (typeof exportsField === "string")
    out.push({ root: true, target: exportsField });
  else if (typeof exportsField === "object" && exportsField !== null) {
    for (const [key, value] of Object.entries(
      exportsField as Record<string, unknown>,
    )) {
      // A key that is not a subpath is a condition on the package root itself
      // (`{"import": "./index.js"}` with no `.` key).
      const root = !key.startsWith(".") || key === ".";
      for (const target of targetsIn(value)) out.push({ root, target });
    }
  }
  return out;
}

/** Every string in an exports value, whatever conditions it nests under. */
function targetsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(targetsIn);
  if (typeof value === "object" && value !== null)
    return Object.values(value as Record<string, unknown>).flatMap(targetsIn);
  return [];
}

const SOURCE_FILE = /\.(ts|tsx|mts|cts)$/;

/**
 * The project-relative source file an entry target names, or undefined when the
 * target is built output, a wildcard, or outside the project. Only a source
 * target can match a graph file, which is what makes the source condition
 * workspaces already declare (`@zod/source`, `development`, `bun`) the one that
 * lands.
 */
function relativeSourceFile(dir: string, target: string): string | undefined {
  if (target.includes("*") || !SOURCE_FILE.test(target)) return undefined;
  const joined = path
    .normalize(path.join(dir, target))
    .split(path.sep)
    .join("/");
  if (joined.startsWith("..")) return undefined;
  return joined;
}
