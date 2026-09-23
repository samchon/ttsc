import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";

/**
 * One project transform sent to a transform worker thread (samchon/ttsc#1391).
 *
 * The worker runs {@link transformProjectInMemory} exactly as the calling thread
 * would have run it at the moment of the call, under the environment the
 * compiler defines. So the request carries both the compiler context and that
 * environment as it was then.
 */
export interface TransformProjectWorkerRequest {
  /** The compiler context of the {@link TtscCompiler} that asked. */
  context: ITtscCompilerContext;

  /**
   * The calling thread's `process.env` at the call with the compiler's own
   * `env` merged over it, as its child processes take it. The worker makes it
   * its own `process.env` for the length of the transform, so an environment
   * the caller configured on the compiler, such as a scratch `TEMP`, covers the
   * whole transform without the caller changing its own globals
   * (samchon/ttsc#1488).
   */
  env: Record<string, string | undefined>;
}
