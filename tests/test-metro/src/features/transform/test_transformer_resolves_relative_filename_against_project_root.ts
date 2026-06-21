import { assertResolvesRelativeFilenameAgainstProjectRoot } from "../../internal/metro-transform";

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
 */
export const test_transformer_resolves_relative_filename_against_project_root =
  async () => {
    await assertResolvesRelativeFilenameAgainstProjectRoot();
  };
