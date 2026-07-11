import { ITtscGraphNext } from "./ITtscGraphNext";

/** A compact, source-read-free project map for broad orientation only. */
export interface ITtscGraphOverview {
  /** Discriminator for source-free project overview. */
  type: "overview";

  /** Absolute project root. */
  project: string;

  /** Size of the graph. */
  counts: ITtscGraphOverview.ICounts;

  /** How to use this source-free result next. */
  next: ITtscGraphNext;

  /** Human-readable compatibility note mirroring `next`. */
  guide: string;

  /** Folder layering, largest first. */
  layers?: ITtscGraphOverview.ILayer[];

  /** Highest-dependency symbols, busiest first. */
  hotspots?: ITtscGraphOverview.IHotspot[];

  /** Exported API symbols, most-depended-on first. */
  publicApi?: ITtscGraphOverview.IPublicApi[];
}
export namespace ITtscGraphOverview {
  /** Which broad architecture facets `overview` should return. */
  export interface IRequest {
    /** Discriminator for source-free project overview. */
    type: "overview";

    /**
     * Facet to project, or `all` for every facet:
     *
     * - `layers`: folder layering
     * - `hotspots`: highest-dependency symbols
     * - `publicApi`: exported API symbols ranked by how depended-on they are
     *
     * Broad public-API or layer orientation only. For behavior, lifecycle,
     * request/render/validation flow, caller, or dependency questions, use
     * `entrypoints` then `trace`.
     *
     * @default "all"
     */
    aspect?: "all" | "layers" | "hotspots" | "publicApi";
  }

  /** Size of the graph by node/edge totals and per-kind node counts. */
  export interface ICounts {
    /** Number of source file container nodes. */
    files: number;

    /** Total node count, including declarations and file containers. */
    nodes: number;

    /** Total edge count, including structural edges. */
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
    /** Stable handle for `details` or `trace`. */
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
   * One exported public-API symbol. The list is ranked by how depended-on the
   * symbol is, excluding test, typings, and generated files.
   */
  export type IPublicApi = INode;
}
