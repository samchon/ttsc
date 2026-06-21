import { assertGatesByIncludeAndExclude } from "../../internal/metro-transform";

/**
 * Verifies the transformer gates files by include and exclude.
 *
 * Pins the full gating matrix: empty include means all TypeScript; a matching
 * include selects and a non-matching include rejects; exclude rejects and must
 * win over a matching include (it is checked first).
 *
 * 1. Assert empty include selects a TypeScript file.
 * 2. Assert include match selects and non-match rejects.
 * 3. Assert exclude rejects, and wins when a file matches both include and
 *    exclude.
 */
export const test_transformer_gates_files_by_include_and_exclude = async () => {
  await assertGatesByIncludeAndExclude();
};
