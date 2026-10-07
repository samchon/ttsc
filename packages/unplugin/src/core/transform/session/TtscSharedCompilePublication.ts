import type { ITtscCompilerTransformation } from "ttsc";

/**
 * One whole-project compile a worker published to its session's store
 * (samchon/ttsc#1390).
 *
 * The envelope names paths inside the publisher's own scratch directory, such
 * as its generated tsconfig. An adopter keeps those paths so it excludes them
 * from its inputs exactly as the publisher would, although they no longer
 * exist.
 *
 * @evidence contracts/common.md#principled-implementation A publication carries compiler output plus the publisher's external-input hashes and physical identities, allowing an adopter to prove the original compile rather than its later reading alone.
 * @evidence contracts/common.md#clear-and-simple-design The envelope and scratch-path context are retained together; the shape does not duplicate the compiler transformation schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The carrier alone certifies no reusable result. Publication producers omit
 *   transient exceptions, store readers reject them, and adopters own proof.
 * @evidence contracts/common.md#meaningful-documentation Member comments explain external-input proof and why vanished publisher scratch paths remain semantically relevant.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Carries the publisher's native external identity witnesses and scratch/config
 *   spellings across workers. Adopters preserve those exclusions and validate
 *   their current filesystem; vanished scratch paths are not live local handles.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscSharedCompilePublication only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscSharedCompilePublication only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscSharedCompilePublication only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscSharedCompilePublication {
  /**
   * Content hash of each external input the publisher recorded right after its
   * compile, keyed by absolute path. A plugin-reported dependency outside the
   * project carries no compile-time proof in the envelope, so an adopter must
   * find exactly these states.
   */
  externalInputHashes: Record<string, string>;

  /** Physical path of each external input, paired with the hashes. */
  externalInputRealpaths: Record<string, string | null>;

  /**
   * The compile's envelope: a `success`, or a `failure` whose diagnostics are
   * as much a function of the published state as an envelope is
   * (samchon/ttsc#1458). Never an `exception`, which may come from a transient
   * crash that every worker must be free to attempt again.
   */
  result: ITtscCompilerTransformation;

  /** The publisher's compiler scratch directory. */
  scratchDirectory: string;

  /** The publisher's generated tsconfig, when the compile used one. */
  temporaryTsconfig?: string;
}
