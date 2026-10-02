/**
 * Subcommands the ttsc CLI dispatches to. The bare `"ttsc"` entry covers the
 * default lane (no explicit subcommand, e.g. `ttsc -p tsconfig.json`).
 *
 * @evidence contracts/common.md#principled-implementation Literal command identities distinguish the default compiler lane from named launcher commands, matching the dispatch vocabulary used by flag selection.
 * @evidence contracts/common.md#clear-and-simple-design A single union records the permitted identities without adding a command registry or dispatch behavior to the representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The ttsc literal intentionally represents the product's default lane rather than a special case for any project or invocation fixture.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why the default lane has a named identity and gives its invocation meaning, applying the documentation skill's purpose and context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type TtscSubcommand =
  | "ttsc"
  | "build"
  | "cache"
  | "check"
  | "fix"
  | "format"
  | "prepare"
  | "clean";
