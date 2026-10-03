import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";

/**
 * One project transform sent to a transform worker thread.
 *
 * The worker invokes {@link transformProjectInMemory} with the captured
 * compiler context and invocation environment. Structured cloning and the
 * plugin JSON channel transport caller data; they do not freeze filesystem
 * state, scheduler timing or separate worker caches at request creation.
 *
 * @evidence contracts/common.md#principled-implementation The context determines project behavior, while a separate complete environment snapshot establishes invocation-time authority for the worker's in-process work and children.
 * @evidence contracts/common.md#clear-and-simple-design Compiler selectors, plugin JSON payloads and thread-local ambient state remain distinct: a separate JSON channel preserves custom serialization when structured cloning drops the local adapter method.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Structured-clone data carries real caller authority without replacing the calling thread's global environment or adding measurement-only configuration.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the snapshot timing and why scratch-directory authority must cover in-process work, with separated member comments following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The snapshot is merged by native environment-name identity before crossing the worker boundary; native project paths remain context values rather than shell command text.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface TransformProjectWorkerRequest {
  /** The compiler context of the {@link TtscCompiler} that asked. */
  context: ITtscCompilerContext;

  /**
   * Captured JSON for each explicit plugin, paired by array index. Existing
   * constructor-captured payloads are reused; an uncaptured context is encoded
   * when the request is made.
   * The worker restores local adapters without reevaluating custom toJSON.
   * Undefined preserves configuration-discovered or disabled plugin selection.
   */
  serializedPlugins?: readonly (string | undefined)[];

  /**
   * The calling thread's `process.env` at the call with the compiler's own
   * `env` merged over it, as its child processes take it. The worker makes it
   * its own `process.env` before the transform and retains it until the next
   * request adopts another environment or the worker exits. An environment
   * the caller configured on the compiler, such as a scratch `TEMP`, covers the
   * whole transform without the caller changing its own globals.
   */
  env: Record<string, string | undefined>;
}
