/**
 * Options for {@link createCompilerClient}.
 *
 * @evidence contracts/common.md#principled-implementation A script URL is the input accepted by the tgrid Worker connector; this type does not advertise unsupported Worker construction options.
 * @evidence contracts/common.md#clear-and-simple-design The single client input stays distinct from worker-side compiler configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Worker creation uses tgrid's supported URL boundary instead of replacing its internals.
 * @evidence contracts/common.md#meaningful-documentation The member comment explains script ownership and classic Worker constraints, following documentation-skill prose separation.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface ICreateCompilerClientOptions {
  /**
   * URL of the bundled worker script (the site's rspack output of its
   * `compiler/index.ts` worker entry, which calls `createWorkerCompiler`).
   *
   * The Worker is constructed by tgrid's `WorkerConnector` with classic Worker
   * semantics. A custom Worker factory hook is intentionally not exposed — the
   * upstream tgrid v1 API only accepts a URL. File an issue if you need module
   * workers, named workers, or custom credentials.
   */
  workerUrl: string;
}
