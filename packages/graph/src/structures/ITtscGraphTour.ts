import { ITtscGraphDecorator } from "./ITtscGraphDecorator";

/** Answer-ready, source-free tour evidence for broad code-flow questions. */
export interface ITtscGraphTour {
  /** Discriminator for code-tour indexing. */
  type: "tour";

  /** Natural code question this tour was built for. */
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
   */
  export interface IRequest {
    /** Discriminator for code-tour indexing. */
    type: "tour";

    /**
     * The tour question, in the user's own words — the same ask as `question`.
     *
     * Its terms rank the tour: a name sharing one is promoted, a name sharing
     * none demoted. Trim what the user wrote, but neither reword it nor add
     * terms of your own.
     */
    query: string;

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
     * Nodes this flow reached that its steps did not already name. A step names
     * both of its ends and the file and line the call sits on, so repeating
     * those nodes here would be the same fact twice.
     */
    reached: ITtscGraphTour.INode[];

    /** True when some low-signal flow steps were capped; the flow stands. */
    truncated?: boolean;
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
