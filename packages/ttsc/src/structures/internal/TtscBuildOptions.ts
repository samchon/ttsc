import type { TtscCommonOptions } from "./TtscCommonOptions";

/**
 * Internal options for a TypeScript-Go project build.
 *
 * @evidence contracts/common.md#principled-implementation Optional emit preserves force-emit, force-no-emit and config-defined states; fix/format name host commands whose source rewrites differ from output emission.
 * @evidence contracts/common.md#clear-and-simple-design Shared process/project options are inherited once, while this record adds only project-build controls rather than unrelated single-file path policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Overrides are declared host controls; format restrictions and no-emit fix behavior address actual command contracts rather than fixture-only logic.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc spells out the three emit states, source-rewrite effects, launcher restrictions and quiet default; paragraphs, member and tag spacing follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Config and output-directory overrides are native path values interpreted by the build owner from cwd, while inherited environment and passthrough argv remain structured; this type does not embed POSIX shell or separator assumptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface TtscBuildOptions extends TtscCommonOptions {
  /** Project config file to compile. Relative paths are resolved from `cwd`. */
  tsconfig?: string;

  /**
   * Emit override for the current call.
   *
   * - `true`: force file writes even when the project has `noEmit`.
   * - `false`: force diagnostics/check-only behavior.
   * - `undefined`: follow the resolved tsconfig exactly.
   */
  emit?: boolean;

  /**
   * Invoke fix-capable check-stage plugins before the final no-emit check.
   * Source files may be rewritten; JavaScript/declaration emit stays disabled.
   */
  fix?: boolean;

  /**
   * Invoke format-capable check-stage plugins. Source files may be rewritten
   * with formatter-class edits (whitespace, punctuation, ordering); diagnostics
   * are not reported and JavaScript/declaration emit stays disabled. The
   * launcher selects this through the `ttsc format` subcommand and rejects
   * combination with watch mode, single-file mode, or an explicit `--emit`.
   */
  format?: boolean;

  /** Per-call TypeScript-Go `outDir` override. */
  outDir?: string;

  /** Suppress summary banners from ttsc/native sidecars. Defaults to `true`. */
  quiet?: boolean;
}
