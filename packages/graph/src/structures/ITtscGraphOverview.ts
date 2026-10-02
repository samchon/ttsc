/**
 * A compact, source-read-free project map for broad orientation only.
 *
 * @evidence contracts/common.md#principled-implementation Counts and optional facet collections describe graph structure without claiming runtime behavior.
 * @evidence contracts/common.md#clear-and-simple-design The envelope separates totals from layers, dependency hotspots and public API projections.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Facets carry graph observations rather than repository-name-based architecture guesses.
 * @evidence contracts/common.md#meaningful-documentation Native member comments describe each facet's ordering and the absolute project locator.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface ITtscGraphOverview {
  /** Discriminator for source-free project overview. */
  type: "overview";

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
  /**
   * Which broad architecture facets `overview` should return.
   *
   * @evidence contracts/common.md#principled-implementation The aspect union names exactly the supported structural projections and all selects their combination.
   * @evidence contracts/common.md#clear-and-simple-design One optional selector replaces independent flags for the same mutually selectable facets.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The request explicitly selects orientation; it does not rewrite a runtime-flow question into an overview.
   * @evidence contracts/common.md#meaningful-documentation The aspect comment states default behavior and explains which questions need other operations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
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

  /**
   * Size of the graph by node/edge totals and per-kind node counts.
   *
   * @evidence contracts/common.md#principled-implementation Separate totals distinguish source containers, all nodes and all edges while the keyed record preserves per-kind counts.
   * @evidence contracts/common.md#clear-and-simple-design Four aggregate fields carry counts without retaining the counted graph entries.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Counts include their documented structural populations rather than selected fixture totals.
   * @evidence contracts/common.md#meaningful-documentation Comments explain which containers and structural edges contribute to each total.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
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

  /**
   * One folder layer: its source files and export surface.
   *
   * @evidence contracts/common.md#principled-implementation A directory coordinate and distinct file/export counts represent a structural layer without inferring architectural intent.
   * @evidence contracts/common.md#clear-and-simple-design Only the directory and its two aggregate populations are retained.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Folder names are coordinates, not hardcoded semantic layer classifications.
   * @evidence contracts/common.md#meaningful-documentation Comments state project-relative directory spelling and what each count includes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface ILayer {
    /** Directory, project-relative. */
    dir: string;

    /** Distinct source files under it. */
    files: number;

    /** Exported symbols declared under it. */
    exported: number;
  }

  /**
   * A compact symbol coordinate that can be passed to deeper graph tools.
   *
   * @evidence contracts/common.md#principled-implementation Identity, name, kind and coordinates express a graph symbol while unknown line remains optional.
   * @evidence contracts/common.md#clear-and-simple-design The common coordinate is reused by hotspots and public API entries without embedded implementation text.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The record keeps stable identity instead of guessing a symbol from its display name.
   * @evidence contracts/common.md#meaningful-documentation Member comments identify stable follow-up handles, qualified names and one-based lines.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
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

  /**
   * A high-dependency symbol with its non-structural fan-in and fan-out.
   *
   * @evidence contracts/common.md#principled-implementation Directional non-structural edge counts express dependency connectivity instead of counting containment as usage.
   * @evidence contracts/common.md#clear-and-simple-design Extending the common node adds only incoming and outgoing counts.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Connectivity is reported as graph structure, not a fixture-specific importance verdict.
   * @evidence contracts/common.md#meaningful-documentation The type and member comments explicitly distinguish non-structural fan-in and fan-out.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface IHotspot extends INode {
    /** Non-structural edges pointing at this symbol. */
    fanIn: number;

    /** Non-structural edges leaving this symbol. */
    fanOut: number;
  }

  /**
   * One exported public-API symbol. The list is ranked by how depended-on the
   * symbol is, excluding test, typings, and generated files.
   *
   * @evidence contracts/common.md#principled-implementation The alias uses the same coordinate representation because public API membership changes selection, not node shape.
   * @evidence contracts/common.md#clear-and-simple-design A type alias avoids duplicating the identical INode record.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Selection exclusions concern source provenance, not named downstream projects.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph explains ranking and excluded populations rather than restating the alias.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export type IPublicApi = INode;
}
