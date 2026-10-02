import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphEvidence } from "./ITtscGraphEvidence";

/**
 * The first compact source-free handle list for a TypeScript code question.
 *
 * @evidence contracts/common.md#principled-implementation Hits, explicit mentions and neighborhoods distinguish ranked selection from handle resolution and direct relationships.
 * @evidence contracts/common.md#clear-and-simple-design The three collections share compact node records instead of inlining source or another request shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The result exposes truncation rather than representing a capped shortlist as complete.
 * @evidence contracts/common.md#meaningful-documentation Native member comments distinguish ranking, explicit mentions and capped context with separated member blocks.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphEntrypoints declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphEntrypoints declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphEntrypoints declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphEntrypoints declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface ITtscGraphEntrypoints {
  /** Discriminator for first-pass question indexing. */
  type: "entrypoints";

  /** Ranked symbols relevant to the query. */
  hits: ITtscGraphEntrypoints.IHit[];

  /** Code handles written directly in the query, resolved when possible. */
  mentions: ITtscGraphEntrypoints.IMention[];

  /** Direct dependency context for the resolved mentions and highest hits. */
  neighborhood: ITtscGraphEntrypoints.INeighborhood[];

  /** True when some low-signal seeds or references were capped; the list stands. */
  truncated?: boolean;
}

export namespace ITtscGraphEntrypoints {
  /**
   * First handles when the question is narrow but the symbol name is not yet
   * known.
   *
   * @evidence contracts/common.md#principled-implementation Query plus optional hit and neighbor limits specify first-pass indexing without requiring an already resolved symbol.
   * @evidence contracts/common.md#clear-and-simple-design Two bounds control different result populations; the query remains the sole search input.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Bounds are caller-visible result options, not hidden agent throttling.
   * @evidence contracts/common.md#meaningful-documentation Field comments explain the question input, limit defaults and when deeper tools should replace a wider list.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphEntrypoints.IRequest declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphEntrypoints.IRequest declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphEntrypoints.IRequest declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphEntrypoints.IRequest declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface IRequest {
    /** Discriminator for first-pass question indexing. */
    type: "entrypoints";

    /**
     * A natural code question or search phrase, prose mixed with code handles
     * (`how Repository.find loads relations`). Keep it close to the user's
     * question, not a broad keyword dump.
     */
    query: string;

    /**
     * Maximum ranked hits to return.
     *
     * @default 4
     */
    limit?: number;

    /**
     * Maximum direct dependencies and dependents per indexed symbol. An
     * orientation slice, not a dependency dump; use `trace` or `details` with
     * `neighbors:true` after choosing the specific handles.
     *
     * @default 0
     */
    neighbors?: number;
  }

  /**
   * A compact symbol coordinate, optionally with its declaration signature.
   *
   * @evidence contracts/common.md#principled-implementation Stable identity and source coordinates represent a symbol; optional signature and decorators preserve available declaration facts.
   * @evidence contracts/common.md#clear-and-simple-design Shared node coordinates avoid duplicating the same shape across hits and neighborhoods.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional facts remain absent when unavailable rather than becoming fabricated declarations.
   * @evidence contracts/common.md#meaningful-documentation Native comments state stable handles, one-based lines and signature availability beside separated members.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphEntrypoints.INode declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphEntrypoints.INode declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphEntrypoints.INode declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphEntrypoints.INode declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface INode {
    /** Stable node id for subsequent graph calls. */
    id: string;

    /** Qualified symbol name when available, otherwise the simple name. */
    name: string;

    /** Declaration kind (`class`, `method`, `function`, ...). */
    kind: string;

    /** Project-relative path of the declaration file. */
    file: string;

    /** 1-based declaration line, when known. */
    line?: number;

    /** Declaration head, included only for indexed symbols. */
    signature?: string;

    /** Decorators written on this declaration, when any. */
    decorators?: ITtscGraphDecorator[];
  }

  /**
   * One ranked search hit.
   *
   * @evidence contracts/common.md#principled-implementation Extending the node coordinate with a relative score separates relevance from resolved identity.
   * @evidence contracts/common.md#clear-and-simple-design Inheritance adds only the fact unique to a ranked hit.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A score reports ranking, not proof that this declaration answers the question.
   * @evidence contracts/common.md#meaningful-documentation The score comment states its direction and relative meaning without implying confidence.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphEntrypoints.IHit declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphEntrypoints.IHit declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphEntrypoints.IHit declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphEntrypoints.IHit declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface IHit extends INode {
    /** Relative relevance; higher is a better match. */
    score: number;
  }

  /**
   * A code handle written in the query, with its resolution status.
   *
   * @evidence contracts/common.md#principled-implementation The original handle and optional node or candidates distinguish successful and ambiguous resolution.
   * @evidence contracts/common.md#clear-and-simple-design One mention record keeps submitted text beside its resolution instead of mixing it into scored hits.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Ambiguous names carry candidates rather than a guessed winner.
   * @evidence contracts/common.md#meaningful-documentation The native comments explain the original spelling and unambiguous versus ambiguous outcomes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphEntrypoints.IMention declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphEntrypoints.IMention declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphEntrypoints.IMention declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphEntrypoints.IMention declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface IMention {
    /** The exact handle text found in the query. */
    handle: string;

    /** Resolved node when the handle maps unambiguously. */
    node?: INode;

    /** Candidate nodes when the handle is ambiguous. */
    candidates?: INode[];
  }

  /**
   * Direct dependency context around one indexed symbol.
   *
   * @evidence contracts/common.md#principled-implementation Separate outgoing and incoming lists preserve relationship direction around the indexed node.
   * @evidence contracts/common.md#clear-and-simple-design Extending the compact node adds only its two context lists.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The lists represent direct capped context rather than inventing transitive paths.
   * @evidence contracts/common.md#meaningful-documentation Each list documents its direction and the neighbor bound, with a blank line between members.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphEntrypoints.INeighborhood declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphEntrypoints.INeighborhood declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphEntrypoints.INeighborhood declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphEntrypoints.INeighborhood declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface INeighborhood extends INode {
    /** Symbols this node directly uses, capped by `neighbors`. */
    dependsOn: IReference[];

    /** Symbols that directly use this node, capped by `neighbors`. */
    dependedOnBy: IReference[];
  }

  /**
   * One neighboring symbol and the relationship leading to it.
   *
   * @evidence contracts/common.md#principled-implementation Neighbor identity, relation kind and optional source span represent one resolved dependency without losing its cause.
   * @evidence contracts/common.md#clear-and-simple-design Coordinates and relation are kept together so callers need no second node lookup to display context.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Evidence reports the actual reference rather than substituting a matching name.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain stable handles, coordinate units and edge evidence without source bodies.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphEntrypoints.IReference declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphEntrypoints.IReference declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphEntrypoints.IReference declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphEntrypoints.IReference declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface IReference {
    /** Stable id of the neighboring node. */
    id: string;

    /** Neighbor symbol name, qualified when available. */
    name: string;

    /** Neighbor declaration kind. */
    kind: string;

    /** Project-relative declaration file for the neighbor. */
    file: string;

    /** 1-based declaration line, when known. */
    line?: number;

    /** Edge kind connecting the indexed node and this neighbor. */
    relation: string;

    /** Source span for the edge: shows why it exists without opening the file. */
    evidence?: ITtscGraphEvidence;
  }
}
