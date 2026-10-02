import assert from "node:assert/strict";

import { insideExcludedProjectDirectory } from "../../../../../packages/unplugin/src/core/transform/project/insideExcludedProjectDirectory";
import type { ITtscProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/ITtscProjectMembershipPolicy";

/**
 * Verifies configured directory exclusions use compiler case policy independently
 * of the selected Windows path grammar.
 *
 * The compiler supplies case sensitivity to both include and exclude matching.
 * These authored policies exercise that supported boundary, without claiming
 * that this machine's Windows filesystem has either case policy.
 *
 * 1. Contrast Output descendants with output descendants under both policies.
 * 2. Require strict mode to exempt the exact entry according to the same policy.
 * 3. Keep component, drive and empty-policy negatives independent of casing.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual insideExcludedProjectDirectory with its existing explicit win32 platform argument and immutable compiler policies; literal verdicts require policy-sensitive directory containment and strict exact-entry exemption.
 * @evidence contracts/testing.md#independent-expectations Literal Output/output rows express the compiler's exact versus case-insensitive exclusion semantics, which pinned typescript-go vfsmatch supplies to exclude patterns. Expected booleans are written independently of Node relative, product containment or a second matcher.
 * @evidence contracts/testing.md#distinguishing-cases Both policies contrast matching-case and different-case descendants, exact entries in ordinary and strict mode, a sibling sharing the excluded prefix, another drive and an empty exclusion policy. Strict mode still excludes descendants and never converts the exact configured file entry into a directory-only exclusion.
 * @evidence contracts/testing.md#execution-ownership One source unit invokes the existing pure policy helper with explicit Windows lexical paths; no filesystem, compiler, watcher, process, platform monkeypatch or private generation state runs. This checks authored compiler-policy semantics rather than native filesystem case behavior.
 */
export function test_project_directory_exclusions_follow_compiler_case_policy(): void {
  for (const useCaseSensitiveFileNames of [true, false]) {
    const policy: ITtscProjectMembershipPolicy = Object.freeze({
      excludedDirectories: Object.freeze(["C:\\project\\Output"]),
      inputExtensions: Object.freeze([".ts"]),
      sources: Object.freeze([]),
      useCaseSensitiveFileNames,
    });
    const rows: readonly (readonly [string, boolean, boolean])[] = [
      ["C:\\project\\Output\\main.ts", false, true],
      ["C:\\project\\Output\\main.ts", true, true],
      ["C:\\project\\output\\main.ts", false, !useCaseSensitiveFileNames],
      ["C:\\project\\output\\main.ts", true, !useCaseSensitiveFileNames],
      ["C:\\project\\Output", false, true],
      ["C:\\project\\Output", true, false],
      ["C:\\project\\output", false, !useCaseSensitiveFileNames],
      ["C:\\project\\output", true, false],
      ["C:\\project\\OutputSibling\\main.ts", false, false],
      ["D:\\project\\Output\\main.ts", false, false],
    ];
    for (const [location, strictly, expected] of rows) {
      assert.equal(
        insideExcludedProjectDirectory(location, policy, strictly, "win32"),
        expected,
        JSON.stringify({ useCaseSensitiveFileNames, location, strictly }),
      );
    }
    const empty: ITtscProjectMembershipPolicy = Object.freeze({
      ...policy,
      excludedDirectories: Object.freeze([]),
    });
    assert.equal(insideExcludedProjectDirectory("C:\\project\\Output\\main.ts", empty, false, "win32"), false);
  }
}
