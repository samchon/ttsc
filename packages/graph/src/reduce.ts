// Reduce a raw `ttscgraph dump` to the payload the bundled 3D viewer renders.
// This mirrors website/src/components/graph/graphReduce.ts (the same pure
// transform); keep the two in sync. The CLI reduces in Node before serving, so
// the browser viewer only ever renders a ready `{ nodes, links }`.

export interface RawNode {
  id: string;
  name: string;
  kind: string;
  file: string;
  external?: boolean;
}

export interface RawEdge {
  from: string;
  to: string;
  kind: string;
}

export interface RawDump {
  project?: string;
  nodes: RawNode[];
  edges: RawEdge[];
}

export interface ViewerNode {
  id: string;
  name: string;
  kind: string;
  file: string;
  degree: number;
}

export interface ViewerLink {
  source: string;
  target: string;
  kind: string;
}

export interface ViewerPayload {
  project: string;
  counts: {
    rawNodes: number;
    rawEdges: number;
    nodes: number;
    links: number;
    droppedExternal: number;
    droppedByCap: number;
  };
  nodes: ViewerNode[];
  links: ViewerLink[];
}

function posix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Absolute POSIX, Windows drive, or UNC path; relative dumps skip rerooting. */
function isAbsolute(p: string): boolean {
  return /^(?:[A-Za-z]:)?\//.test(posix(p));
}

function isWindowsPath(p: string): boolean {
  const normalized = posix(p);
  return /^[A-Za-z]:(?:\/|$)/.test(normalized) || normalized.startsWith("//");
}

function directoryOf(file: string): string {
  const normalized = posix(file).replace(/\/+$/, "");
  const slash = normalized.lastIndexOf("/");
  if (slash < 0) return "";
  return slash === 0 ? "/" : normalized.slice(0, slash);
}

function commonRoot(directories: string[]): string {
  if (directories.length === 0) return "";
  let parts = posix(directories[0]!).split("/");
  const caseInsensitive = directories.every(isWindowsPath);
  for (const directory of directories.slice(1)) {
    const other = posix(directory).split("/");
    let i = 0;
    while (
      i < parts.length &&
      i < other.length &&
      (caseInsensitive
        ? parts[i]!.toLowerCase() === other[i]!.toLowerCase()
        : parts[i] === other[i])
    )
      i++;
    parts = parts.slice(0, i);
    if (parts.length === 0) break;
  }
  return parts.join("/");
}

// A null root means the dump's paths are already project-relative (the current
// `ttscgraph dump` contract); they pass through structure-intact.
function relativize(abs: string, root: string | null): string {
  const a = posix(abs);
  if (root === null) return a;
  const normalizedRoot = posix(root);
  const r = normalizedRoot === "/" ? "/" : normalizedRoot.replace(/\/+$/, "");
  const caseInsensitive = isWindowsPath(a) && isWindowsPath(r);
  const comparedPath = caseInsensitive ? a.toLowerCase() : a;
  const comparedRoot = caseInsensitive ? r.toLowerCase() : r;
  if (
    comparedRoot &&
    (comparedRoot === "/" ||
      comparedPath === comparedRoot ||
      comparedPath.startsWith(comparedRoot + "/"))
  )
    return a.slice(r.length).replace(/^\/+/, "");
  const nm = a.lastIndexOf("node_modules/");
  if (nm >= 0) return a.slice(nm);
  const slash = a.lastIndexOf("/");
  return slash >= 0 ? a.slice(slash + 1) : a;
}

function rewriteId(id: string, root: string | null): string {
  const hash = id.indexOf("#");
  if (hash < 0) return id;
  return relativize(id.slice(0, hash), root) + id.slice(hash);
}

function degreeOf(
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
): Map<string, number> {
  const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (degree.has(e.from)) degree.set(e.from, degree.get(e.from)! + 1);
    if (degree.has(e.to)) degree.set(e.to, degree.get(e.to)! + 1);
  }
  return degree;
}

/**
 * Collapse the fine-grained wire kinds `ttscgraph dump` emits (calls,
 * instantiates, renders, accesses, type_ref, extends, implements, overrides)
 * into the three display families the viewer colors and its legend name. An
 * unknown kind passes through and renders with the fallback color.
 */
const DISPLAY_KIND: Record<string, string> = {
  calls: "value-call",
  instantiates: "value-call",
  renders: "value-call",
  accesses: "value-call",
  type_ref: "type-ref",
  extends: "heritage",
  implements: "heritage",
  overrides: "heritage",
};

function displayKind(kind: string): string {
  return DISPLAY_KIND[kind] ?? kind;
}

export function reduce(
  raw: RawDump,
  {
    maxNodes = 1200,
    keepExternal = false,
  }: { maxNodes?: number; keepExternal?: boolean } = {},
): ViewerPayload {
  const keptByExternal = raw.nodes.filter((n) => keepExternal || !n.external);
  // Reroot only absolute paths (the legacy dump contract); a current dump's
  // paths are already project-relative and keep their structure as-is.
  const projectFiles = raw.nodes.filter((n) => !n.external).map((n) => n.file);
  const root =
    projectFiles.length > 0 && isAbsolute(projectFiles[0]!)
      ? commonRoot(projectFiles.map(directoryOf))
      : null;

  const liveIds = new Set(keptByExternal.map((n) => n.id));
  const liveEdges = raw.edges.filter(
    (e) => liveIds.has(e.from) && liveIds.has(e.to),
  );

  const degree = degreeOf(keptByExternal, liveEdges);
  let kept = keptByExternal;
  let droppedByCap = 0;
  if (kept.length > maxNodes) {
    kept = [...kept]
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
      .slice(0, maxNodes);
    droppedByCap = keptByExternal.length - kept.length;
  }

  const keptIds = new Set(kept.map((n) => n.id));
  const edges = liveEdges.filter(
    (e) => keptIds.has(e.from) && keptIds.has(e.to),
  );
  const finalDegree = degreeOf(kept, edges);

  const nodes: ViewerNode[] = kept
    .filter((n) => (finalDegree.get(n.id) ?? 0) > 0)
    .map((n) => ({
      id: rewriteId(n.id, root),
      name: n.name,
      kind: n.kind,
      file: relativize(n.file, root),
      degree: finalDegree.get(n.id) ?? 0,
    }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: ViewerLink[] = edges
    .map((e) => ({
      source: rewriteId(e.from, root),
      target: rewriteId(e.to, root),
      kind: displayKind(e.kind),
    }))
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return {
    project: raw.project ?? "",
    counts: {
      rawNodes: raw.nodes.length,
      rawEdges: raw.edges.length,
      nodes: nodes.length,
      links: links.length,
      droppedExternal: raw.nodes.length - keptByExternal.length,
      droppedByCap,
    },
    nodes,
    links,
  };
}
