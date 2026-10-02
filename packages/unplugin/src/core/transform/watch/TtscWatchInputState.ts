import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * Exact generation state behind one derived watch input.
 *
 * @evidence contracts/common.md#principled-implementation The codec discriminant binds each observation to its own comparison payload; membership remains a project walk and cannot be substituted for one file's hash.
 * @evidence contracts/common.md#clear-and-simple-design The closed union colocates each codec with only its required state, making invalid cross-codec combinations unrepresentable.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Contract-defined codec values select real observation semantics; no fixture or host-specific expected digest is encoded.
 * @evidence contracts/common.md#meaningful-documentation Spaced native member comments explain hash provenance, physical targets, plugin environment and membership policy; separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native targets and predicate observations are explicit payloads; plugin-tree state includes the build environment rather than assuming an OS name establishes equivalence.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscWatchInputState only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscWatchInputState only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscWatchInputState only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export type TtscWatchInputState =
  | {
      /** A project-walk or dependency-only input read as ordinary host bytes. */
      codec: "host";

      /** Raw host-byte hash, or the shared missing/directory state marker. */
      hash: string;
    }
  | {
      /** A realized compiler-graph input, including its physical target. */
      codec: "graph";

      /** Compiler-normalized input hash, or the shared missing-input marker. */
      hash: string;

      /** Observed physical target, or null when realpath could not be read. */
      realpath: string | null;
    }
  | {
      /** The exact compiler predicates observed for a resolver input. */
      codec: "predicates";

      /** The recorded predicates; omitted facts make no claim. */
      observation: ITtscCompilerTransformation.IInputObservation;
    }
  | {
      /**
       * A Go source directory a plugin binary of the generation was built from
       * (samchon/ttsc#1487). The input's path is the directory, observed as a
       * whole subtree, and its state is the one the build keyed the binary on,
       * the sources with the environment a build there is keyed on
       * (`pluginSourceState` from `ttsc/plugin-source`, samchon/ttsc#1493),
       * which only ttsc's rule proves (`pluginSourceStateHolds`): no one path's
       * metadata stands for the files below it.
       */
      codec: "tree";

      /** Shared plugin-source and build-environment state digest. */
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
