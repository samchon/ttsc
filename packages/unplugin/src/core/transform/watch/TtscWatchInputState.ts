import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

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
    }
  | {
      /**
       * A Go source directory a plugin binary of the generation was built from
       * (samchon/ttsc#1487). The input's path is the directory, observed as a
       * whole subtree, and its state is the one the build keyed the binary on,
       * the sources with the environment a build there is keyed on
       * (`pluginSourceState` from `ttsc/plugin-source`, samchon/ttsc#1493),
       * which only recomputing it proves: no one path's metadata stands for the
       * files below it.
       */
      codec: "tree";
      digest: string;
    }
  | {
      /**
       * The project's root-file membership, which the adapter's project walk
       * decides rather than the compiler (samchon/ttsc#1419). The input's path
       * is the project root.
       */
      codec: "membership";
      /**
       * `projectMembershipDigest` of the walk: the policy and every directory
       * that can hold a program input, with its membership signature.
       */
      digest: string;
      /**
       * Every directory the walk enters, including those that hold no program
       * input yet, since a file created in one is a new root file.
       */
      directories: readonly string[];
      /** The rule the walk applied, which a re-walk must apply too. */
      policy: ITtscProjectMembershipPolicy;
    };
