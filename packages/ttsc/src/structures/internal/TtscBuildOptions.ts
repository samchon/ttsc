import type { TtscCommonOptions } from "./TtscCommonOptions";

/**
 * Internal options for a TypeScript-Go project build.
 *
 * @evidence contracts/common.md#principled-implementation Optional emit distinguishes requested emission, analysis and project-defined selection; forwarded compiler flags retain their documented precedence, while fix/format request host commands separately from emission selection.
 * @evidence contracts/common.md#clear-and-simple-design Shared process/project options are inherited once, while this record adds only project-build controls rather than unrelated single-file path policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Overrides are declared host controls; the launcher owns command restrictions and mutation-command emission suppression, while API callers supply their own selection rather than relying on fixture-specific behavior.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc spells out emit selection and forwarded-option precedence, source-rewrite command effects, launcher restrictions and verbosity ownership; paragraphs, member and tag spacing follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Config and output-directory overrides are native path values interpreted by the build owner from cwd, while inherited environment and passthrough argv remain structured; this type does not embed POSIX shell or separator assumptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface TtscBuildOptions extends TtscCommonOptions {
  /** Config file or containing directory, absolute or resolved from `cwd`. */
  tsconfig?: string;

  /**
   * Emit override for the current call.
   *
   * - `true`: request emission despite the project's `noEmit` setting.
   * - `false`: select the analysis/check lane.
   * - `undefined`: use the project's `noEmit` selection.
   *
   * Forwarded compiler options follow these compiler defaults and can override
   * them. Emission still depends on successful checks and producer behavior.
   */
  emit?: boolean;

  /**
   * Request the fix command from configured check-stage hosts. A host may
   * reject unsupported commands. Source files may be rewritten. The launcher
   * also sets `emit: false`; API callers select emission separately.
   */
  fix?: boolean;

  /**
   * Request the format command from configured check-stage hosts. Source files
   * may be rewritten, and a host may reject unsupported commands. With `emit:
   * false`, the dispatcher adds no later type-check or transform pass. The
   * launcher sets that emit selection for `ttsc format` and rejects watch mode,
   * single-file mode, or an explicit enabled `--emit`.
   */
  format?: boolean;

  /** Per-call output-directory request, absolute or resolved from `cwd`. */
  outDir?: string;

  /**
   * Request native quiet/verbose presentation; `false` also adds ttsc's direct
   * build summary. The launcher defaults to `true`; omitted SDK values leave
   * native verbosity modifiers unset.
   */
  quiet?: boolean;
}
