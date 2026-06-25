import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphOverview } from "../structures/ITtscGraphOverview";

/** Edges that express nesting/packaging, not code dependency. */
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);

/**
 * Project a compact, source-read-free architecture map: counts by kind, folder
 * layering with export density, the highest-dependency symbols (ranked by real
 * fan-in/out, excluding structural edges so nesting does not masquerade as
 * dependency), and the export surface by file. Output is bounded so a model
 * reads structure cheaply.
 */
export function runOverview(
  graph: TtscGraphMemory,
  props: ITtscGraphOverview.IProps,
): ITtscGraphOverview {
  const aspect = props.aspect ?? "all";
  const want = (a: ITtscGraphOverview.IProps["aspect"]): boolean =>
    aspect === "all" || aspect === a;

  const byKind: Record<string, number> = {};
  let files = 0;
  for (const node of graph.nodes) {
    byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
    if (node.kind === "file") files++;
  }

  const result: ITtscGraphOverview = {
    project: graph.project,
    counts: {
      files,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      byKind,
    },
  };
  if (want("layers")) result.layers = layers(graph);
  if (want("hotspots")) result.hotspots = hotspots(graph);
  if (want("publicApi")) result.publicApi = publicApi(graph);
  return result;
}

/** Folder-level layering: how source and its export surface spread by directory. */
function layers(graph: TtscGraphMemory): ITtscGraphOverview.ILayer[] {
  const byDir = new Map<string, { files: Set<string>; exported: number }>();
  for (const node of graph.nodes) {
    if (node.external || node.kind === "file") continue;
    const dir = dirname(node.file);
    let entry = byDir.get(dir);
    if (!entry) {
      entry = { files: new Set(), exported: 0 };
      byDir.set(dir, entry);
    }
    entry.files.add(node.file);
    if (node.exported) entry.exported++;
  }
  return [...byDir.entries()]
    .map(([dir, entry]) => ({
      dir,
      files: entry.files.size,
      exported: entry.exported,
    }))
    .sort((a, b) => b.files - a.files)
    .slice(0, 16);
}

/**
 * The symbols at the center of the dependency graph, ranked by real fan-in and
 * fan-out — structural `contains`/`exports`/`imports` edges are excluded so the
 * ranking reflects code dependency, not nesting.
 */
function hotspots(graph: TtscGraphMemory): ITtscGraphOverview.IHotspot[] {
  const real = (id: string, side: "in" | "out"): number => {
    const edges = side === "in" ? graph.incoming(id) : graph.outgoing(id);
    let n = 0;
    for (const edge of edges) if (!STRUCTURAL_KINDS.has(edge.kind)) n++;
    return n;
  };
  return graph.nodes
    .filter((node) => !node.external && node.kind !== "file")
    .map((node) => ({
      id: node.id,
      name: node.qualifiedName ?? node.name,
      kind: node.kind,
      file: node.file,
      fanIn: real(node.id, "in"),
      fanOut: real(node.id, "out"),
    }))
    .filter((h) => h.fanIn + h.fanOut > 0)
    .sort((a, b) => b.fanIn + b.fanOut - (a.fanIn + a.fanOut))
    .slice(0, 15);
}

/** The exported public surface, grouped by file and ordered by surface size. */
function publicApi(graph: TtscGraphMemory): ITtscGraphOverview.IPublicApi[] {
  const byFile = new Map<string, string[]>();
  for (const node of graph.exported()) {
    if (node.kind === "file") continue;
    const list = byFile.get(node.file) ?? [];
    if (list.length < 24) list.push(node.qualifiedName ?? node.name);
    byFile.set(node.file, list);
  }
  return [...byFile.entries()]
    .map(([file, symbols]) => ({ file, symbols }))
    .sort((a, b) => b.symbols.length - a.symbols.length)
    .slice(0, 24);
}

/** The parent directory of a project-relative path (`.` at the root). */
function dirname(file: string): string {
  const slash = file.lastIndexOf("/");
  return slash >= 0 ? file.slice(0, slash) : ".";
}
