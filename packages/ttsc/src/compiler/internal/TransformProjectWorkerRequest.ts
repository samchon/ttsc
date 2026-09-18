import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";

/**
 * One project transform sent to a transform worker thread (samchon/ttsc#1391).
 *
 * The worker runs {@link transformProjectInMemory} exactly as the calling thread
 * would have run it at the moment of the call. So the request carries both the
 * compiler context and the calling thread's `process.env` as it was then.
 */
export interface TransformProjectWorkerRequest {
  /** The compiler context of the {@link TtscCompiler} that asked. */
  context: ITtscCompilerContext;

  /**
   * The calling thread's `process.env` at the call. The worker makes it its own
   * `process.env` for the length of the transform, so a scope the caller put
   * around the call, such as a scratch `TEMP`, covers the whole transform.
   */
  env: Record<string, string | undefined>;
}
