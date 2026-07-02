// Browser-side port of experimental/benchmark/graph/viewer.mjs `reduce()`, so the
// 3D viewer can take a raw `@ttsc/graph` dump (what `ttscgraph dump` prints) and
// turn it into the render payload without any server. Keep in sync with that
// file; both are the same pure transform.
import type { ITtscWebsiteGraphViewer } from "../../structures/ITtscWebsiteGraphViewer";

type RawNode = ITtscWebsiteGraphViewer.RawNode;
type RawDump = ITtscWebsiteGraphViewer.RawDump;
type ViewerNode = ITtscWebsiteGraphViewer.Node;
type ViewerLink = ITtscWebsiteGraphViewer.Link;
type ViewerPayload = ITtscWebsiteGraphViewer.Payload;

function posix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Longest shared directory prefix of POSIX-normalized paths. */
function commonRoot(files: string[]): string {
  if (files.length === 0) return "";
  let parts = posix(files[0]!).split("/");
  for (const file of files.slice(1)) {
    const other = posix(file).split("/");
    let i = 0;
    while (i < parts.length && i < other.length && parts[i] === other[i]) i++;
    parts = parts.slice(0, i);
    if (parts.length === 0) break;
  }
  return parts.join("/");
}

/**
 * Make an absolute path project-relative; a path outside the project keeps the
 * portion from its last node_modules/ segment, or its base name.
 */
function relativize(abs: string, root: string): string {
  const a = posix(abs);
  const r = posix(root).replace(/\/+$/, "");
  if (r && (a === r || a.startsWith(r + "/")))
    return a.slice(r.length).replace(/^\/+/, "");
  const nm = a.lastIndexOf("node_modules/");
  if (nm >= 0) return a.slice(nm);
  const slash = a.lastIndexOf("/");
  return slash >= 0 ? a.slice(slash + 1) : a;
}

/**
 * A node id is `<path>#<name>:<kind>`; rewrite only the path prefix so ids stay
 * a stable key and every edge endpoint (also an id) relativizes identically.
 */
function rewriteId(id: string, root: string): string {
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
 * instantiates, renders, accesses, type_ref, extends, implements) into the
 * three display families the viewer colors and its legend name. An unknown kind
 * passes through and renders with the fallback color.
 */
const DISPLAY_KIND: Record<string, string> = {
  calls: "value-call",
  instantiates: "value-call",
  renders: "value-call",
  accesses: "value-call",
  type_ref: "type-ref",
  extends: "heritage",
  implements: "heritage",
};

function displayKind(kind: string): string {
  return DISPLAY_KIND[kind] ?? kind;
}

/**
 * Reduce a raw dump to the viewer payload: relativized, external-free, capped
 * to the highest-degree nodes, with orphans pruned.
 */
function reduce(
  raw: RawDump,
  {
    maxNodes = 1000,
    keepExternal = false,
    keepIgnored = false,
  }: ITtscWebsiteGraphViewer.ReduceOptions = {},
): ViewerPayload {
  // Drop external boundary leaves and git-ignored generated code (a Prisma
  // client and the like, tagged `ignored` by the dump) so the authored graph is
  // not buried under codegen.
  const keep = (n: RawNode) =>
    (keepExternal || !n.external) && (keepIgnored || !n.ignored);
  const keptBoundary = raw.nodes.filter(keep);
  const root = commonRoot(
    raw.nodes.filter((n) => !n.external && !n.ignored).map((n) => n.file),
  );

  const liveIds = new Set(keptBoundary.map((n) => n.id));
  const liveEdges = raw.edges.filter(
    (e) => liveIds.has(e.from) && liveIds.has(e.to),
  );

  const degree = degreeOf(keptBoundary, liveEdges);
  let kept = keptBoundary;
  let droppedByCap = 0;
  if (kept.length > maxNodes) {
    kept = [...kept]
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
      .slice(0, maxNodes);
    droppedByCap = keptBoundary.length - kept.length;
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
      external: n.external === true,
      ignored: n.ignored === true,
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
    schemaVersion: 1,
    project: raw.project ?? "",
    provenance: raw.provenance ?? "checker-resolved",
    counts: {
      rawNodes: raw.nodes.length,
      rawEdges: raw.edges.length,
      nodes: nodes.length,
      links: links.length,
      droppedExternal: keepExternal
        ? 0
        : raw.nodes.filter((n) => n.external).length,
      droppedIgnored: keepIgnored
        ? 0
        : raw.nodes.filter((n) => n.ignored && !n.external).length,
      droppedByCap,
    },
    nodes,
    links,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A raw graphdump: `{ nodes: [...], edges: [{from,to,kind}] }`. */
function isRawDump(json: unknown): json is RawDump {
  return (
    isObject(json) && Array.isArray(json.nodes) && Array.isArray(json.edges)
  );
}

/**
 * An already-reduced viewer payload: `{ nodes: [...], links: [{source,target}]
 * }`.
 */
function isViewerPayload(json: unknown): json is ViewerPayload {
  return (
    isObject(json) && Array.isArray(json.nodes) && Array.isArray(json.links)
  );
}

/** Accept either shape (a `ttscgraph dump` raw graph or a pre-reduced payload). */
function toViewerPayload(
  json: unknown,
  opts?: { maxNodes?: number },
): ViewerPayload | null {
  if (isViewerPayload(json)) return json;
  if (isRawDump(json)) return reduce(json, opts);
  return null;
}

const TtscWebsiteGraphReduce = {
  isRawDump,
  isViewerPayload,
  reduce,
  toViewerPayload,
};

export default TtscWebsiteGraphReduce;
