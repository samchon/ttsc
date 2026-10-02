/**
 * Options shared by `build`, `check`, and `transform`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Required cwd and optional tsconfig mirror the native project endpoints;
 *   omission delegates the default to the host that loads the project.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The shared request contains project root and config selection only; the
 *   chosen API verb owns whether that project is emitted, checked or projected.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Project identity comes from the caller, rather than a consumer-specific root.
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc distinguishes virtual absolute cwd from relative config paths
 *   and names the default, following the documentation skill's clear prose.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscBuildOpts is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscBuildOpts is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscBuildOpts is a data interface and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscBuildOpts is a data interface and performs no native filesystem, path or process operation.
 */
export interface ITtscBuildOpts {
  /** Absolute virtual path the project lives at inside the MemFS. */
  cwd: string;

  /** Tsconfig path, relative to `cwd`. Defaults to `tsconfig.json`. */
  tsconfig?: string;
}
