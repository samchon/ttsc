/**
 * A compact, source-read-free architecture map of the project — the result of
 * the `graph_overview` tool.
 */
export interface ITtscGraphOverview {
  /** Absolute project root. */
  project: string;

  /** Size of the graph. */
  counts: ITtscGraphOverview.ICounts;

  /** Folder layering, largest first. */
  layers?: ITtscGraphOverview.ILayer[];

  /** Highest-dependency symbols, busiest first. */
  hotspots?: ITtscGraphOverview.IHotspot[];

  /** Exported API symbols, most-depended-on first. */
  publicApi?: ITtscGraphOverview.IPublicApi[];
}
export namespace ITtscGraphOverview {
  /** Which architecture facets `graph_overview` should return. */
  export interface IProps {
    /**
     * The facet to project, or `all` for every facet. `layers` is the folder
     * layering, `hotspots` the highest-dependency symbols, `publicApi` the
     * exported API symbols ranked by how depended-on they are.
     *
     * @default "all"
     */
    aspect?: "all" | "layers" | "hotspots" | "publicApi";
  }

  /** Size of the graph by node/edge totals and per-kind node counts. */
  export interface ICounts {
    files: number;
    nodes: number;
    edges: number;
    /** Node count per kind. */
    byKind: Record<string, number>;
  }

  /** One folder layer: its source files and export surface. */
  export interface ILayer {
    /** Directory, project-relative. */
    dir: string;
    /** Distinct source files under it. */
    files: number;
    /** Exported symbols declared under it. */
    exported: number;
  }

  /** A high-dependency symbol with its non-structural fan-in and fan-out. */
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

  /**
   * One symbol on the project's exported public API surface. The list is ranked
   * by how depended-on the symbol is, with test, typings, and generated files
   * excluded, so the names a consumer of the project would reach for surface
   * first — not whichever file happens to declare the most exports.
   */
  export interface IPublicApi {
    /** The exported symbol's name. */
    name: string;
    /** Its declaration kind (`class`, `interface`, `function`, …). */
    kind: string;
    /** Project-relative path of the file that declares it. */
    file: string;
  }
}
