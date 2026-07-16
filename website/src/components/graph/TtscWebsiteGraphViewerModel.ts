// Pure helpers behind the 3D viewer's explorer UI: filter projection, the
// file tree, symbol search, and neighborhood/highlight computation. No three.js
// and no React here, so every transform is unit-checkable in isolation.
import type { ITtscWebsiteGraphViewer } from "../../structures/ITtscWebsiteGraphViewer";

type ViewerLink = ITtscWebsiteGraphViewer.Link;
type ViewerNode = ITtscWebsiteGraphViewer.Node;

// ---------------------------------------------------------------------------
// Display constants (shared by the scene, the sidebar chips, and the legend)
// ---------------------------------------------------------------------------

/** Node kinds in display order; chips and legends iterate this order. */
const NODE_KIND_ORDER: readonly string[] = [
  "class",
  "interface",
  "function",
  "method",
  "type",
  "enum",
  "variable",
];

const NODE_COLORS: Record<string, string> = {
  class: "#3178c6",
  interface: "#2563eb",
  function: "#15803d",
  method: "#0f766e",
  type: "#b45309",
  enum: "#7e22ce",
  variable: "#64748b",
};

const LINK_COLORS: Record<string, string> = {
  "value-call": "#15803d",
  "type-ref": "#b45309",
  heritage: "#2563eb",
};

const LINK_KIND_LABEL: Record<string, string> = {
  "value-call": "value-call (runtime use)",
  "type-ref": "type-ref",
  heritage: "heritage (extends / implements)",
};

// ---------------------------------------------------------------------------
// Filter projection
// ---------------------------------------------------------------------------

/** The node/link slice the scene renders; a filtered view of the payload. */
export interface ViewerSlice {
  nodes: ViewerNode[];
  links: ViewerLink[];
}

function fileMatches(file: string, selected: string): boolean {
  return selected.endsWith("/") ? file.startsWith(selected) : file === selected;
}

/**
 * Cut the view down to the two-hop neighborhood of one node. This is the only
 * explorer operation that removes anything from the view; every other control
 * is a spotlight over what stays.
 */
function isolate(slice: ViewerSlice, id: string | null): ViewerSlice {
  if (id === null || !slice.nodes.some((n) => n.id === id)) return slice;
  const adjacency = new Map<string, string[]>();
  for (const l of slice.links) {
    (
      adjacency.get(l.source) ?? adjacency.set(l.source, []).get(l.source)!
    ).push(l.target);
    (
      adjacency.get(l.target) ?? adjacency.set(l.target, []).get(l.target)!
    ).push(l.source);
  }
  const keep = new Set<string>([id]);
  let frontier: string[] = [id];
  for (let hop = 0; hop < 2; hop++) {
    const next: string[] = [];
    for (const current of frontier)
      for (const neighbor of adjacency.get(current) ?? [])
        if (!keep.has(neighbor)) {
          keep.add(neighbor);
          next.push(neighbor);
        }
    frontier = next;
  }
  return {
    nodes: slice.nodes.filter((n) => keep.has(n.id)),
    links: slice.links.filter((l) => keep.has(l.source) && keep.has(l.target)),
  };
}

/** The node kinds present in a payload, in chip display order. */
function kindsIn(nodes: ViewerNode[]): string[] {
  const present = new Set(nodes.map((n) => n.kind));
  const ordered = NODE_KIND_ORDER.filter((kind) => present.has(kind));
  for (const kind of present) if (!ordered.includes(kind)) ordered.push(kind);
  return ordered;
}

// ---------------------------------------------------------------------------
// File tree
// ---------------------------------------------------------------------------

export interface FileTreeEntry {
  /** Display segment; single-child directory chains collapse into "a/b/c". */
  name: string;
  /** Filter path: directories carry a trailing slash, files their exact path. */
  path: string;
  dir: boolean;
  /** Symbols under this entry in the (reduced) payload. */
  count: number;
  children: FileTreeEntry[];
}

interface MutableDir {
  name: string;
  path: string;
  count: number;
  dirs: Map<string, MutableDir>;
  files: Map<string, number>;
}

/**
 * Fold the payload's file paths into a directory tree with per-entry symbol
 * counts. The tree only contains files that survived the payload reduction,
 * which keeps it a few hundred entries even for a repo the size of VS Code.
 */
function buildFileTree(nodes: ViewerNode[]): FileTreeEntry[] {
  const root: MutableDir = {
    name: "",
    path: "",
    count: 0,
    dirs: new Map(),
    files: new Map(),
  };
  for (const node of nodes) {
    const segments = node.file.split("/");
    let dir = root;
    dir.count += 1;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!;
      let next = dir.dirs.get(segment);
      if (!next) {
        next = {
          name: segment,
          path: `${dir.path}${segment}/`,
          count: 0,
          dirs: new Map(),
          files: new Map(),
        };
        dir.dirs.set(segment, next);
      }
      next.count += 1;
      dir = next;
    }
    const file = segments[segments.length - 1]!;
    dir.files.set(file, (dir.files.get(file) ?? 0) + 1);
  }

  const toEntry = (mutable: MutableDir): FileTreeEntry => {
    // Collapse single-child directory chains ("src" -> "src/compiler") the way
    // an editor tree does, so deep repos stay one glance wide.
    let current = mutable;
    let name = mutable.name;
    while (current.files.size === 0 && current.dirs.size === 1) {
      const only = [...current.dirs.values()][0]!;
      name = `${name}/${only.name}`;
      current = only;
    }
    return {
      name,
      path: current.path,
      dir: true,
      count: current.count,
      children: childrenOf(current),
    };
  };

  const childrenOf = (dir: MutableDir): FileTreeEntry[] => [
    ...[...dir.dirs.values()]
      .map(toEntry)
      .sort((a, b) => a.name.localeCompare(b.name)),
    ...[...dir.files.entries()]
      .map(
        ([file, count]): FileTreeEntry => ({
          name: file,
          path: `${dir.path}${file}`,
          dir: false,
          count,
          children: [],
        }),
      )
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];

  return childrenOf(root);
}

// ---------------------------------------------------------------------------
// Symbol search
// ---------------------------------------------------------------------------

/**
 * Rank nodes for the search box: exact name, then name prefix, then name
 * substring, then file substring; ties break toward the better-connected node.
 */
function searchNodes(
  nodes: ViewerNode[],
  query: string,
  limit = 20,
): ViewerNode[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const scored: { node: ViewerNode; score: number }[] = [];
  for (const node of nodes) {
    const name = node.name.toLowerCase();
    let score = 0;
    if (name === q) score = 4;
    else if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if (node.file.toLowerCase().includes(q)) score = 1;
    if (score > 0) scored.push({ node, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.node.degree - a.node.degree)
    .slice(0, limit)
    .map((hit) => hit.node);
}

// ---------------------------------------------------------------------------
// Selection neighborhood
// ---------------------------------------------------------------------------

/**
 * What the scene needs to paint a spotlight: the lit node set, the lit edges,
 * and (for a node selection) the node drawn in the selection color. Everything
 * outside the sets stays visible but dimmed; a spotlight never removes nodes.
 */
export interface ViewerHighlight {
  selectedId: string | null;
  neighborIds: Set<string>;
  linkKeys: Set<string>;
}

function linkKey(source: string, target: string): string {
  return `${source}\u0000${target}`;
}

/** One-hop neighborhood of `id` over the displayed links. */
function highlightOf(links: ViewerLink[], id: string): ViewerHighlight {
  const neighborIds = new Set<string>();
  const linkKeys = new Set<string>();
  for (const l of links) {
    if (l.source !== id && l.target !== id) continue;
    neighborIds.add(l.source === id ? l.target : l.source);
    linkKeys.add(linkKey(l.source, l.target));
  }
  return { selectedId: id, neighborIds, linkKeys };
}

/** The explorer's spotlight selectors: a file scope, node kinds, edge families. */
export interface SpotlightQuery {
  file: string | null;
  kinds: ReadonlySet<string>;
  edgeKinds: ReadonlySet<string>;
}

/**
 * Combine the selectors into one spotlight. A file scope and a kind selection
 * intersect ("the classes in src/foo"), and every edge touching the lit nodes
 * lights up with them, including edges reaching out to (still dimmed) outside
 * nodes, so external connections stay readable. Edge families restrict which of
 * those edges light, or, selected alone, light their own endpoints. Null means
 * nothing is selected and the scene renders undimmed.
 */
function spotlight(
  slice: ViewerSlice,
  query: SpotlightQuery,
): ViewerHighlight | null {
  const byNode = query.file !== null || query.kinds.size > 0;
  const byEdge = query.edgeKinds.size > 0;
  if (!byNode && !byEdge) return null;
  const edgeOk = (kind: string) =>
    query.edgeKinds.size === 0 || query.edgeKinds.has(kind);
  const neighborIds = new Set<string>();
  const linkKeys = new Set<string>();
  if (byNode) {
    for (const n of slice.nodes)
      if (
        (query.file === null || fileMatches(n.file, query.file)) &&
        (query.kinds.size === 0 || query.kinds.has(n.kind))
      )
        neighborIds.add(n.id);
    for (const l of slice.links)
      if (
        edgeOk(l.kind) &&
        (neighborIds.has(l.source) || neighborIds.has(l.target))
      )
        linkKeys.add(linkKey(l.source, l.target));
  } else {
    for (const l of slice.links)
      if (edgeOk(l.kind)) {
        linkKeys.add(linkKey(l.source, l.target));
        neighborIds.add(l.source);
        neighborIds.add(l.target);
      }
  }
  return { selectedId: null, neighborIds, linkKeys };
}

export interface EdgeSummaryRow {
  kind: string;
  out: number;
  in: number;
}

/** Per-family out/in edge counts of `id` over the displayed links. */
function edgeSummary(links: ViewerLink[], id: string): EdgeSummaryRow[] {
  const rows = new Map<string, EdgeSummaryRow>();
  for (const l of links) {
    if (l.source !== id && l.target !== id) continue;
    let row = rows.get(l.kind);
    if (!row) {
      row = { kind: l.kind, out: 0, in: 0 };
      rows.set(l.kind, row);
    }
    if (l.source === id) row.out += 1;
    else row.in += 1;
  }
  return [...rows.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

const TtscWebsiteGraphViewerModel = {
  LINK_COLORS,
  LINK_KIND_LABEL,
  NODE_COLORS,
  buildFileTree,
  edgeSummary,
  highlightOf,
  isolate,
  kindsIn,
  linkKey,
  searchNodes,
  spotlight,
};

export default TtscWebsiteGraphViewerModel;
