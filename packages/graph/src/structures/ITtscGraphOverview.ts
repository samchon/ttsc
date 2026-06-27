/**
 * A compact, source-read-free architecture map of the project returned by
 * `project_overview`.
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
  /** Which architecture facets `project_overview` should return. */
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

  /** A compact symbol coordinate that can be passed to deeper graph tools. */
  export interface INode {
    /** Stable handle for `symbol_details` or `dependency_path`. */
    id: string;
    /** The symbol's qualified name when available. */
    name: string;
    /** Its declaration kind (`class`, `interface`, `function`, ...). */
    kind: string;
    /** Project-relative path of the file that declares it. */
    file: string;
    /** 1-based declaration line, when known. */
    line?: number;
  }

  /** A high-dependency symbol with its non-structural fan-in and fan-out. */
  export interface IHotspot extends INode {
    /** Non-structural edges pointing at this symbol. */
    fanIn: number;
    /** Non-structural edges leaving this symbol. */
    fanOut: number;
  }

  /**
   * One symbol on the project's exported public API surface. The list is ranked
   * by how depended-on the symbol is, with test, typings, and generated files
   * excluded.
   */
  export type IPublicApi = INode;
}
