import type { ITtscCompilerTransformation } from "ttsc";

/** Exact generation state behind one derived watch input. */
export type TtscWatchInputState =
  | {
      /** A project-walk or dependency-only input read as ordinary host bytes. */
      codec: "host";
      hash: string;
    }
  | {
      /** A realized compiler-graph input, including its physical target. */
      codec: "graph";
      hash: string;
      realpath: string | null;
    }
  | {
      /** The exact compiler predicates observed for a resolver input. */
      codec: "predicates";
      observation: ITtscCompilerTransformation.IInputObservation;
    };
