import { ITtscGraphDecorator } from "./ITtscGraphDecorator";

/** Answer-ready, source-free tour evidence for broad code-flow questions. */
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
   * It asks for no question of its own — it ranks against the `question` the
   * caller has already written, in the user's words.
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
