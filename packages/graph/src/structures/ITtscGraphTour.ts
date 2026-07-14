import { ITtscGraphDecorator } from "./ITtscGraphDecorator";

/** Answer-ready, source-free tour evidence for broad code-flow questions. */
export interface ITtscGraphTour {
  /** Discriminator for code-tour indexing. */
  type: "tour";

  /** The question this tour was built for, as the caller wrote it. */
  query: string;

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
   * The whole answer surface for a broad code tour: entrypoints, primary flow,
   * nearby paths, tests, and answer anchors.
   *
   * It asks for no question of its own. It used to carry a `query`, described
   * in its own schema as "the same ask as `question`" — the field the caller
   * has already filled two lines above — and a schema that asks for one string
   * twice gets it once: GPT-5.6 sent `{ "type": "tour" }` with no query in **31
   * of 32 cells**, the validator rejected it, and the model re-sent the whole
   * call. Every Codex tour cost a wasted round trip, and a Codex turn re-sends
   * its whole context, so the duplicate field was most of what the tool spent.
   *
   * The words that rank the tour are the question's, and the question is where
   * the caller writes them. Asking for them twice also lost them: told to keep
   * the user's words in `question`, Opus wrote `how does Zod carry
   * `schema.parse` from the public API`, and then paraphrased them into `query`
   * as "how does Zod carry schema.parse" — dropping the backticks the mention
   * resolver reads to find the symbol the user named.
   */
  export interface IRequest {
    /** Discriminator for code-tour indexing. */
    type: "tour";

    /**
     * A list of symbol names. Not a sentence — names, one per entry, the way
     * you would type them into a search: `["track", "trigger",
     * "ReactiveEffect", "setupRenderEffect", "queueJob", "patch"]`.
     *
     * They are the machinery you expect the answer to be made of. The question
     * is above, in the user's words, and the tour ranks against them — but a
     * codebase names many things alike, and the question's words cannot tell
     * them apart. "Dependency tracking" matches Vue's devtools hook
     * `onRenderTracked` as well as `track`, the function that actually records
     * the dependency; "request" matches a message listener as well as the HTTP
     * router. The names are how you say which one you mean.
     *
     * Names, not prose. Each is looked up in the graph the way a handle is — a
     * symbol name, a `Class.member`, a `file.symbol`. The ones the graph holds
     * take half the tour's entrypoints; the other half stays with what the
     * graph finds central, so a name you get wrong cannot cost you the tour. A
     * name it does not know, or one it knows several of, is simply dropped: a
     * wrong guess is free, and a phrase like "the public API and its runtime
     * path" buys nothing. Write the names you would grep for, before you have
     * seen a line.
     *
     * Send `[]` when the question names no machinery — an orientation tour of a
     * repository you have not seen, "show me the central flow". Then there is
     * nothing to reinterpret: the tour ranks on structure, which is what that
     * question is asking for, and `[]` is the whole and correct answer. Do not
     * go looking for names to put here first. A lookup before the tour is a
     * call spent to fill a field that the tour would have ignored anyway.
     */
    reinterpretations: string[];

    /**
     * Central entrypoints to seed the tour. Raise only when the question names
     * several public paths that must all appear in one answer.
     *
     * @default 4
     */
    limit?: number;

    /**
     * Include graph-reached test or usage anchors when available.
     *
     * @default true
     */
    includeTests?: boolean;
  }

  /** A compact symbol coordinate for a tour. */
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

  /** A primary flow slice from one selected entrypoint. */
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
   */
  export interface IReached {
    /** Stable node id for later graph calls: `file#Qualified.Name:kind`. */
    id: string;

    /** Qualified symbol name when available, otherwise the simple name. */
    name: string;

    /** 1-based declaration line, when known. */
    line?: number;
  }

  /** A file/line citation chosen by the graph, not source body text. */
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

  /** Source coordinates without source text. */
  export interface ISpan {
    /** Project-relative file. */
    file: string;

    /** 1-based start line. */
    startLine: number;

    /** 1-based end line, when known. */
    endLine?: number;
  }
}
