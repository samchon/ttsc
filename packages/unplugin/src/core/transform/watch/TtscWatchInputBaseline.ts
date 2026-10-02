import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscWatchInputFileBaseline } from "./TtscWatchInputFileBaseline";

/**
 * Main-process observations for comparing one-path watch-input codecs.
 *
 * @evidence contracts/common.md#principled-implementation Separate hashes and predicates represent the different compiler, host and plugin-tree observations without treating their codecs as interchangeable.
 * @evidence contracts/common.md#clear-and-simple-design Extending the file baseline shares its identity predicate while named fields expose the broader comparison facts.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit null reads and failed realpath variants retain unavailable observations instead of expected hashes or guessed targets.
 * @evidence contracts/common.md#meaningful-documentation Member comments distinguish read failure, stat classification and optional subtree capture, with spacing and a blank tag separator following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native stat kinds and realpath success are represented as observed facts; identity and lexical target are not conflated by a case-fold rule.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscWatchInputBaseline only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscWatchInputBaseline only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscWatchInputBaseline only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscWatchInputBaseline extends TtscWatchInputFileBaseline {
  /**
   * Sorted compiler-accessible entry names, captured only when requested.
   * Absence cannot establish a recorded listing predicate's agreement.
   */
  accessibleEntries?: NonNullable<
    ITtscCompilerTransformation.IInputObservation["accessibleEntries"]
  >;

  /** Whether the compiler's stat classifies the path as a directory. */
  directoryExists: boolean;

  /** State hash under the `graph` evidence codec, or the missing-input marker. */
  graphHash: string;

  /**
   * Hash of the compiler-style read an observation's `readFile` predicate
   * records, or `null` when that read fails.
   */
  graphReadHash: string | null;

  /** State hash under the `host` evidence codec, or the missing-input marker. */
  hostHash: string;

  /** The compiler's realpath observation of the path. */
  realpath: { ok: false; path?: never } | { ok: true; path: string };

  /** The compiler's stat classification of the path. */
  stat: "directory" | "file" | "missing";

  /**
   * The path's state as a plugin source directory, its files and build
   * environment (`pluginSourceState`, samchon/ttsc#1487, samchon/ttsc#1493),
   * captured only for a path recorded as one, since the state reads every file
   * below it; `null` when it cannot be read.
   */
  tree?: string | null;
}
