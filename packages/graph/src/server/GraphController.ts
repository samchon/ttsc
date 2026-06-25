import { GraphModel } from "../model/GraphModel";
import { IExpandProps, IExpandResult, runExpand } from "./expand";
import { IQueryProps, IQueryResult, runQuery } from "./query";

/**
 * The MCP tool surface, as a plain class. Each public method is one tool; its
 * parameter object becomes the tool's JSON schema and its return value the tool
 * result once `typia.llm.controller<GraphController>()` wraps it at the server
 * layer. Keeping the methods pure logic over {@link GraphModel} — no MCP or
 * typia types here — lets the whole surface be unit-tested without a
 * transport.
 *
 * Every method answers from the resident graph; none recompiles. Output is kept
 * compact and bounded so a model can read structure without a file read, which
 * is the token win the redesign exists for.
 */
export class GraphController {
  public constructor(private readonly graph: GraphModel) {}

  /**
   * A compact architecture map of the project: how big it is, how it is layered
   * by folder, the symbols the most code depends on, and the public API
   * surface. Call this first on an unfamiliar codebase — it names concrete
   * files and symbols for every claim, with no source read.
   *
   * @param props Which facet to project
   * @returns The requested architecture facets
   */
  public overview(props: IOverviewProps): IOverview {
    const aspect = props.aspect ?? "all";
    const want = (a: IOverviewProps["aspect"]): boolean =>
      aspect === "all" || aspect === a;

    const byKind: Record<string, number> = {};
    let files = 0;
    for (const node of this.graph.nodes) {
      byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
      if (node.kind === "file") files++;
    }

    const result: IOverview = {
      project: this.graph.project,
      counts: {
        files,
        nodes: this.graph.nodes.length,
        edges: this.graph.edges.length,
        byKind,
      },
    };
    if (want("layers")) result.layers = this.layers();
    if (want("hotspots")) result.hotspots = this.hotspots();
    if (want("publicApi")) result.publicApi = this.publicApi();
    return result;
  }

  /**
   * Read the declaration source of nodes another tool returned as handles, plus
   * their direct dependencies and dependents on request. This is how you read
   * code the graph has already located — pass every handle you need in one call
   * instead of opening files.
   *
   * @param props The handles to expand
   * @returns The resolved nodes with source, and any handles that did not
   *   resolve
   */
  public expand(props: IExpandProps): IExpandResult {
    return runExpand(this.graph, props);
  }

  /**
   * Find the symbols and clusters most relevant to a natural query, even when
   * you do not know the exact name. Mix code vocabulary and plain words;
   * matches rank by exact and dotted names, CamelCase/subword overlap, file
   * path, and how central the symbol is. Returns handles to follow with
   * `expand` or `trace`.
   *
   * @param props The query and result cap
   * @returns Ranked hits with handles
   */
  public query(props: IQueryProps): IQueryResult {
    return runQuery(this.graph, props);
  }

  /**
   * Folder-level layering: how source and its export surface spread by
   * directory.
   */
  private layers(): ILayer[] {
    const byDir = new Map<string, { files: Set<string>; exported: number }>();
    for (const node of this.graph.nodes) {
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
   * The symbols at the center of the dependency graph, ranked by real fan-in
   * and fan-out — structural `contains`/`exports`/`imports` edges are excluded
   * so the ranking reflects code dependency, not nesting.
   */
  private hotspots(): IHotspot[] {
    const real = (id: string, side: "in" | "out"): number => {
      const edges =
        side === "in" ? this.graph.incoming(id) : this.graph.outgoing(id);
      let n = 0;
      for (const edge of edges) if (!STRUCTURAL_KINDS.has(edge.kind)) n++;
      return n;
    };
    return this.graph.nodes
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
  private publicApi(): IPublicApi[] {
    const byFile = new Map<string, string[]>();
    for (const node of this.graph.exported()) {
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
}

/** Edges that express nesting/packaging, not code dependency. */
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);

/** The parent directory of a project-relative path (`.` at the root). */
function dirname(file: string): string {
  const slash = file.lastIndexOf("/");
  return slash >= 0 ? file.slice(0, slash) : ".";
}

/** Which architecture facets `overview` should return. */
export interface IOverviewProps {
  /**
   * The facet to project, or `all` for every facet. `layers` is the folder
   * layering, `hotspots` the highest-dependency symbols, `publicApi` the export
   * surface.
   *
   * @default "all"
   */
  aspect?: "all" | "layers" | "hotspots" | "publicApi";
}

/** A compact, source-read-free architecture map. */
export interface IOverview {
  /** Absolute project root. */
  project: string;
  /** Size of the graph. */
  counts: {
    files: number;
    nodes: number;
    edges: number;
    /** Node count per kind. */
    byKind: Record<string, number>;
  };
  /** Folder layering, largest first. */
  layers?: ILayer[];
  /** Highest-dependency symbols, busiest first. */
  hotspots?: IHotspot[];
  /** Export surface by file, widest first. */
  publicApi?: IPublicApi[];
}

export interface ILayer {
  /** Directory, project-relative. */
  dir: string;
  /** Distinct source files under it. */
  files: number;
  /** Exported symbols declared under it. */
  exported: number;
}

export interface IHotspot {
  id: string;
  name: string;
  kind: string;
  file: string;
  /** Non-structural edges pointing at this symbol. */
  fanIn: number;
  /** Non-structural edges leaving this symbol. */
  fanOut: number;
}

export interface IPublicApi {
  file: string;
  /** Exported symbol names declared in the file (capped). */
  symbols: string[];
}
