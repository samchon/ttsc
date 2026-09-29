import { ITtscGraphDecorator } from "./ITtscGraphDecorator";

/**
 * Answer-ready, source-free tour evidence for broad code-flow questions.
 *
 * @evidence contracts/common.md#principled-implementation Separate seeds, graph flows and citation collections express a selected index tour without claiming complete runtime execution.
 * @evidence contracts/common.md#clear-and-simple-design Each tour facet has one collection; shared coordinates avoid embedding source bodies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Truncation reports omitted extras rather than hiding a cutoff to improve tool-call metrics.
 * @evidence contracts/common.md#meaningful-documentation Native comments distinguish flow facts, nearby/test anchors and citation-only answer anchors.
 */
export interface ITtscGraphTour {
  /** Discriminator for code-tour indexing. */
  type: "tour";

  /** Central entrypoints selected for the tour. */
  entrypoints: ITtscGraphTour.INode[];

  /** Selected primary runtime flows; sufficient for an index-level tour. */
  primaryFlow: ITtscGraphTour.IFlow[];

  /** Nearby dependency anchors around the selected entrypoints. */
  nearby: ITtscGraphTour.IAnchor[];

  /** Test or usage anchors reached through graph impact edges. */
  tests: ITtscGraphTour.IAnchor[];

  /** Ordered file/line anchors to cite in the final answer, not file reads. */
  answerAnchors: ITtscGraphTour.IAnchor[];

  /** True when some low-signal extras were capped; the returned tour stands. */
  truncated?: boolean;
}

export namespace ITtscGraphTour {
  /**
   * A broad code tour: entrypoints, primary flow, nearby paths, and tests.
   *
   * It uses the outer question for explicit handles and the caller's symbol
   * reinterpretations for identifier alignment, alongside graph centrality.
   *
   * @evidence contracts/common.md#principled-implementation Reinterpretations supply resolved candidate handles and identifier alignment; the outer question supplies explicit mentions, and optional limits select entries.
   * @evidence contracts/common.md#clear-and-simple-design Caller-supplied symbol guesses remain distinct from the outer question rather than being merged into another prose query.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An empty guess list is supported; unknown or ambiguous guesses do not fabricate seeds.
   * @evidence contracts/common.md#meaningful-documentation Separate member paragraphs explain guesses, empty input, seed allocation and defaults rather than requiring repository reconnaissance.
   */
  export interface IRequest {
    /** Discriminator for code-tour indexing. */
    type: "tour";

    /**
     * Symbol names, never a sentence: the machinery you expect the answer to be
     * made of, spelled the way this codebase would spell it. A question about
     * how a job reaches a worker is reinterpreted as `["JobQueue.push",
     * "Scheduler.tick", "Worker.run", "drainQueue"]`.
     *
     * Write them from the question, before you have seen a line of the code. A
     * codebase names many things alike, and the question's own words cannot
     * tell them apart: a question about _tracking_ matches the debug hook named
     * after tracking as readily as the function that does it, and one about a
     * _request_ matches a message listener as readily as an HTTP router. The
     * names say which you meant.
     *
     * Each is resolved like a handle — a symbol name, a `Class.member`. The
     * ones the graph holds take half the tour's entrypoints, the rest stays
     * with what the graph finds central, and a name it does not know, or knows
     * several of, is dropped. So a wrong guess costs nothing, and a specific
     * name is worth more than a general one: `drainQueue` resolves, `queue`
     * does not.
     *
     * Send `[]` when the question names no machinery — "show me the central
     * flow" in a repository you have never seen. There is nothing to
     * reinterpret then: the tour ranks on structure, which is what that
     * question asks for. Do not look names up first to fill this.
     */
    reinterpretations: string[];

    /**
     * Central entrypoints to seed the tour. Raise only when the question names
     * several public paths that must all appear in one answer.
     *
     * @default 5
     */
    limit?: number;

    /**
     * Include graph-reached test or usage anchors when available.
     *
     * @default true
     */
    includeTests?: boolean;
  }

  /**
   * A compact symbol coordinate for a tour.
   *
   * @evidence contracts/common.md#principled-implementation Stable identity, coordinates and optional declaration facts describe a selected symbol without implementation bodies.
   * @evidence contracts/common.md#clear-and-simple-design One compact node is reused by entrypoints and flow starts.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional documentation remains a declaration fact rather than an inferred purpose from naming.
   * @evidence contracts/common.md#meaningful-documentation Member comments explain one-based coordinates, declaration heads and the first doc sentence's role.
   */
  export interface INode {
    /** Stable node id for later graph calls. */
    id: string;

    /** Qualified symbol name when available, otherwise the simple name. */
    name: string;

    /** Declaration kind (`class`, `method`, `function`, ...). */
    kind: string;

    /** Project-relative declaration file. */
    file: string;

    /** 1-based declaration line, when known. */
    line?: number;

    /** Declaration or implementation range, when known. */
    sourceSpan?: ITtscGraphTour.ISpan;

    /** Declaration head, when available. */
    signature?: string;

    /**
     * The first sentence of the doc comment above the declaration: what the
     * project says this symbol is for. A name and an edge say what calls what;
     * this says why, which is what a tour is asked for.
     */
    doc?: string;

    /** Decorators written on the declaration, when any. */
    decorators?: ITtscGraphDecorator[];
  }

  /**
   * A primary flow slice from one selected entrypoint.
   *
   * @evidence contracts/common.md#principled-implementation Start, ordered edge summaries and reached handles distinguish a selected flow slice from a complete call graph.
   * @evidence contracts/common.md#clear-and-simple-design Prose steps serve display while reached records supply actionable identities without parsing that prose.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A truncation flag reports omitted steps; summaries cannot invent bridges between unrelated seeds.
   * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain why reached handles accompany step text and what truncation means.
   */
  export interface IFlow {
    /** Flow start node. */
    start: ITtscGraphTour.INode;

    /** Compact edge summaries in graph order. */
    steps: string[];

    /**
     * Every node this flow reached, with the handle to call the graph with
     * next.
     *
     * A step is prose — it names both of its ends and the file and line the
     * call sits on — and it carries no handle. So the nodes a step names are
     * listed here too: `steps` is the story, `reached` is what to go on with.
     */
    reached: ITtscGraphTour.IReached[];

    /** True when some low-signal flow steps were capped; the flow stands. */
    truncated?: boolean;
  }

  /**
   * A node a flow reached, as its handle and its declaration line.
   *
   * A node id _is_ its coordinates — `path/to/file.ts#Owner.member:kind` — so a
   * reached node carrying `file` and `kind` beside it bought the same fact
   * three times. Across the benchmark corpus that repetition was 15% of every
   * tour, and a tour is re-sent whole on every turn of the conversation it
   * opened.
   *
   * @evidence contracts/common.md#principled-implementation Stable id preserves file and kind coordinates; name and optional line add presentation without losing follow-up identity.
   * @evidence contracts/common.md#clear-and-simple-design The reached record omits coordinates already carried in the id instead of copying the full tour node.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Compacting retains the actual node id rather than substituting abbreviated names.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain id grammar and one-based line units, separated from acknowledgments.
   */
  export interface IReached {
    /** Stable node id for later graph calls: `file#Qualified.Name:kind`. */
    id: string;

    /** Qualified symbol name when available, otherwise the simple name. */
    name: string;

    /** 1-based declaration line, when known. */
    line?: number;
  }

  /**
   * A file/line citation chosen by the graph, not source body text.
   *
   * @evidence contracts/common.md#principled-implementation Required file/start line ground a citation; optional identity and kind allow node and edge anchors in one representation.
   * @evidence contracts/common.md#clear-and-simple-design Reason and coordinates are sufficient to present an anchor without carrying the referenced body.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing node identity is represented as optional rather than fabricated for non-node citations.
   * @evidence contracts/common.md#meaningful-documentation Member comments explain node-dependent optional fields, citation purpose and one-based endpoints.
   */
  export interface IAnchor {
    /** Why this anchor matters in the tour. */
    reason: string;

    /** Stable node id when the anchor belongs to a node. */
    id?: string;

    /** Symbol, edge, or test name to show in the answer. */
    name: string;

    /** Declaration kind, when this anchor belongs to a node. */
    kind?: string;

    /** Project-relative file. */
    file: string;

    /** 1-based start line. */
    startLine: number;

    /** 1-based end line, when known. */
    endLine?: number;
  }

  /**
   * Source coordinates without source text.
   *
   * @evidence contracts/common.md#principled-implementation File and one-based endpoints express the available source range without attaching source bytes.
   * @evidence contracts/common.md#clear-and-simple-design Three fields carry only the citation range needed by tour nodes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown end lines stay absent instead of being guessed from another declaration.
   * @evidence contracts/common.md#meaningful-documentation Native comments state project-relative file spelling and optional endpoint meaning.
   */
  export interface ISpan {
    /** Project-relative file. */
    file: string;

    /** 1-based start line. */
    startLine: number;

    /** 1-based end line, when known. */
    endLine?: number;
  }
}
