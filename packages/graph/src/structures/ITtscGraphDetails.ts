import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphDocTag } from "./ITtscGraphDocTag";
import { ITtscGraphEvidence } from "./ITtscGraphEvidence";

/**
 * Source-free facts for a few selected handles, not a file reader: signatures,
 * member outlines, direct calls and types, implementation candidates,
 * dependency summaries, and sourceSpan citation anchors.
 *
 * @evidence contracts/common.md#principled-implementation Nodes, unknown handles and ambiguity records distinguish resolved declaration facts from unresolved or multiply resolved inputs.
 * @evidence contracts/common.md#clear-and-simple-design The envelope keeps resolution status outside each node's declaration shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ambiguous names retain candidates instead of selecting a convenient declaration.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain source-free details and why ambiguity requires exact ids.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface ITtscGraphDetails {
  /** Discriminator for selected symbol inspection. */
  type: "details";

  /** Selected node facts, in the same order as resolved handles when possible. */
  nodes: ITtscGraphDetails.INode[];

  /** Handles the graph holds no node for. */
  unknown: string[];

  /**
   * Handles that name more than one node, with the nodes they name.
   *
   * A name the graph knows twice is not a name the graph does not know: two
   * classes called `Workbench` are two facts, and answering "unknown" to a
   * handle the checker resolved twice sends the caller to the files for what is
   * already here. Re-call `details` with the `id` of the one the question
   * means.
   */
  ambiguous?: ITtscGraphDetails.IAmbiguity[];
}
export namespace ITtscGraphDetails {
  /**
   * Which selected handles to inspect, and how much of each to return.
   *
   * @evidence contracts/common.md#principled-implementation Handles identify declarations while independent limits select member, dependency and optional neighbor projections.
   * @evidence contracts/common.md#clear-and-simple-design One request groups projection options around the handles they inspect.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Limits are documented caller choices; complete members are the default rather than a hidden sample.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain default bounds, external inclusion and when trace should replace a wider details request.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface IRequest {
    /** Discriminator for selected symbol inspection. */
    type: "details";

    /**
     * Node ids or dotted symbol handles (`OrderService.create`). Prefer one to
     * three; use `trace` for a path instead of widening this call.
     */
    handles: string[];

    /**
     * Also list each node's direct dependencies and dependents (symbols it uses
     * and symbols that use it), capped. A relationship summary, not a file
     * body.
     *
     * @default false
     */
    neighbors?: boolean;

    /**
     * Dependencies and dependents per side when `neighbors:true`. A small
     * orientation slice by default; what uses a symbol grows with its
     * popularity, so `trace` answers the whole "who uses this".
     *
     * @default 2
     */
    neighborLimit?: number;

    /**
     * Owned members for a container or object literal. The complete outline by
     * default — a class's members and an enum's are the symbol itself, so they
     * are not sampled. Pass a number to cap.
     */
    memberLimit?: number;

    /**
     * Direct execution and type references per group. A small orientation slice
     * by default; `trace` follows the whole fan-out.
     *
     * @default 2
     */
    dependencyLimit?: number;

    /**
     * Include dependency-boundary references from node_modules or bundled
     * `.d.ts` libraries. Enable only when external type/API boundaries are the
     * question.
     *
     * @default false
     */
    includeExternal?: boolean;
  }

  /**
   * One handle and the several nodes it names.
   *
   * @evidence contracts/common.md#principled-implementation Submitted handle and candidate list preserve the exact ambiguous resolution outcome.
   * @evidence contracts/common.md#clear-and-simple-design Two fields keep the unresolved choice separate from inspected node facts.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No candidate is promoted to a resolved node solely to avoid clarification.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain submitted spelling and candidate ids for a follow-up selection.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface IAmbiguity {
    /** The handle as submitted. */
    handle: string;

    /** Every node the handle names, each with the id to re-call `details` on. */
    candidates: ICandidate[];
  }

  /**
   * One node a handle could mean: enough to choose, not to answer from.
   *
   * @evidence contracts/common.md#principled-implementation Stable id and declaration coordinates distinguish same-named candidates without claiming their bodies were inspected.
   * @evidence contracts/common.md#clear-and-simple-design Only disambiguation facts are carried rather than a full details payload.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Candidate names do not replace exact identity when selecting one declaration.
   * @evidence contracts/common.md#meaningful-documentation Comments state follow-up id usage, qualified names and optional one-based line.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface ICandidate {
    /** Stable node id: submit this as the handle to select this one. */
    id: string;

    /** Qualified symbol name when available, otherwise the simple name. */
    name: string;

    /** Declaration kind (`class`, `method`, `function`, ...). */
    kind: string;

    /** Project-relative path of the file that declares this node. */
    file: string;

    /** 1-based declaration line, when known. */
    line?: number;
  }

  /**
   * One inspected node: its declared shape and graph coordinates.
   *
   * @evidence contracts/common.md#principled-implementation Optional shape, relationships and literal values preserve distinct checker facts alongside stable identity and declaration coordinates.
   * @evidence contracts/common.md#clear-and-simple-design Independent optional facets support the same node without embedding bodies or a second graph snapshot.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Documentation tags remain reported claims, and missing literal enumeration stays absent rather than guessed from signatures.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain complete literals and members versus sliced relationships, tag interpretation limits and implementation coordinates.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface INode {
    /** Stable node id for subsequent `details` or `trace` calls. */
    id: string;

    /** Qualified symbol name when available, otherwise the simple name. */
    name: string;

    /** Declaration kind (`class`, `method`, `function`, ...). */
    kind: string;

    /** Project-relative path of the file that declares this node. */
    file: string;

    /** 1-based declaration line, when known. */
    line?: number;

    /** The declaration signature: its first line(s) up to the body. */
    signature?: string;

    /** The first sentence of the doc comment above the declaration. */
    doc?: string;

    /** Decorators written on this declaration, when any. */
    decorators?: ITtscGraphDecorator[];

    /**
     * Documentation tags naming what outside the type system this declaration
     * answers to: a specification section, an API operation, a reference
     * document (`@evidence docs/pricing.md#sale`, `@reference …`).
     *
     * Part of what the declaration is, so it is returned whole like its members
     * and its values — long text is elided, and nothing else is cut. The tag is
     * reported as written and never interpreted: the graph does not say the
     * text resolves to anything or that the claim is true.
     */
    docTags?: ITtscGraphDocTag[];

    /** Assigned implementation span, when source comes from one. */
    implementation?: ITtscGraphEvidence;

    /** Direct execution dependencies in source order, with edge evidence. */
    calls?: IReference[];

    /** Direct type dependencies in source order, with edge evidence. */
    types?: IReference[];

    /** Concrete nodes that implement or override this interface/base member. */
    implementedBy?: IReference[];

    /**
     * The complete value set a type alias or enum admits, in TypeScript source
     * form (`"a"`, `1`, `true`, `null`) — the checker's resolved union members,
     * not the quoted tokens that happened to fit in `signature`.
     *
     * Absent when the type has no enumerable value set. A `signature` is capped
     * at the declaration head, so for a union or enum written across several
     * lines this is the field that carries the members.
     */
    literals?: string[];

    /**
     * Owned symbol or top-level property outline a consumer reaches for on a
     * container or object-literal variable, without bodies.
     */
    members?: IMember[];

    /** Declaration or implementation citation range, when known. */
    sourceSpan?: Pick<ITtscGraphEvidence, "file" | "startLine" | "endLine">;

    /** Symbols this node uses (outgoing dependency edges). */
    dependsOn?: IReference[];

    /** Symbols that use this node (incoming dependency edges). */
    dependedOnBy?: IReference[];
  }

  /**
   * One member of a container node, with its signature but not its body.
   *
   * @evidence contracts/common.md#principled-implementation Name, kind and optional declaration facts express a container outline without evaluating a member's implementation.
   * @evidence contracts/common.md#clear-and-simple-design The outline omits relationships and bodies owned by deeper node inspection.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional signature and decorators are available source facts rather than synthesized member content.
   * @evidence contracts/common.md#meaningful-documentation Comments distinguish qualified member names, one-based lines and declaration signatures.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface IMember {
    /** Member name, qualified when the graph records an owner-qualified handle. */
    name: string;

    /** Member kind (`method`, `property`, `class`, ...). */
    kind: string;

    /** 1-based declaration line, when known. */
    line?: number;

    /** The member's declaration signature. */
    signature?: string;

    /** Decorators written on this member, when any. */
    decorators?: ITtscGraphDecorator[];
  }

  /**
   * A dependency neighbor of an inspected node and the edge that links them.
   *
   * @evidence contracts/common.md#principled-implementation Neighbor coordinates, relationship kind and optional edge span represent the resolved adjacency and its grounding.
   * @evidence contracts/common.md#clear-and-simple-design Node presentation and relation cause share one compact record without repeating source bodies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A source span is citation evidence, not an invented instruction to verify the graph's fact.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain stable handles, relation kinds and evidence as coordinates rather than file-read cues.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
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

    /** The edge kind connecting the two (`calls`, `type_ref`, ...). */
    relation: string;

    /**
     * Source span that produced the edge: citation evidence, not a file-read
     * cue.
     */
    evidence?: ITtscGraphEvidence;
  }
}
