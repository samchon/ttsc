import { assertResolvesRelativeFilenameAgainstProjectRoot } from "../../internal/metro-transform-decisions";

/**
 * Verifies the transformer resolves Metro's relative filename against
 * projectRoot.
 *
 * Metro hands the babel transformer a path relative to `projectRoot` and passes
 * `projectRoot` in options. Resolving against `process.cwd()` instead would, in
 * monorepos / non-root launches, point the ttsc pass at a non-existent path,
 * making every file look "outside the project" and silently skipping plugins.
 *
 * 1. Resolve a relative filename with an explicit `projectRoot`.
 * 2. Assert it joins against `projectRoot`.
 * 3. Assert it falls back to cwd only when `projectRoot` is absent.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveAbsoluteFilename("src/app.ts") resolves against options.projectRoot when it is given, and against process.cwd() both when options is an empty object and when options is omitted.
 * @evidence contracts/testing.md#independent-expectations Expected values are computed with path.resolve, the same primitive the implementation uses, so the assertions pin the choice of base (projectRoot versus cwd) rather than the join itself.
 * @evidence contracts/testing.md#distinguishing-cases An explicit string projectRoot selects that base; an options object without it, no options, and null, number, boolean or object projectRoot values all use cwd.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveAbsoluteFilename from packages/metro/src/transformer.ts directly in-process; no filesystem access, upstream or compile.
 */
export const test_transformer_resolves_relative_filename_against_project_root =
  async () => {
    await assertResolvesRelativeFilenameAgainstProjectRoot();
  };
