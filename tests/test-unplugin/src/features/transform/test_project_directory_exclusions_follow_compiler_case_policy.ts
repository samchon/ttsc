import assert from "node:assert/strict";

import { insideExcludedProjectDirectory } from "../../../../../packages/unplugin/src/core/transform/project/insideExcludedProjectDirectory";
import type { ITtscProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/ITtscProjectMembershipPolicy";

/**
 * Verifies configured directory exclusions use compiler case policy independently
 * of the selected native path grammar.
 *
 * The compiler supplies case sensitivity to both include and exclude matching.
 * These authored policies exercise that supported boundary, without claiming
 * that this machine's filesystem has either case policy or every literal name.
 *
 * 1. Contrast Output descendants with output descendants under both policies
 *    and both Windows and POSIX grammar.
 * 2. Require strict mode to exempt exact entries under the same comparison rule.
 * 3. Contrast Unicode simple folding, literal characters, roots and adjacent
 *    component, drive and UNC boundaries without using native filesystem setup.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual insideExcludedProjectDirectory with its existing explicit view-platform argument and immutable compiler policies; literal verdicts require policy-sensitive containment and strict exact-entry exemption under Windows and POSIX grammars.
 * @evidence contracts/testing.md#independent-expectations Literal sensitive/insensitive verdict columns express the compiler's exact versus Unicode simple-fold exclusion semantics, which pinned typescript-go vfsmatch supplies to exclude literal components. Expected booleans are independent of Node relative, product containment or another matcher. Native separators define components; backslash remains literal in the POSIX view.
 * @evidence contracts/testing.md#distinguishing-cases Both grammars contrast Output/output descendants and strict exact variants. Sigma/final-sigma and Kelvin/K positives contrast full-fold-only sharp-s/ss negatives. Adjacent prefix, drive and UNC server/share negatives preserve containment boundaries; native roots, trailing separators, empty policies, regexp punctuation, POSIX backslash and final-newline rows preserve literal meaning and exact comparison.
 * @evidence contracts/testing.md#execution-ownership One source entry invokes the existing pure policy helper with authored absolute paths and explicit Windows/POSIX views. It runs no filesystem, compiler, watcher, process, platform monkeypatch or private generation state. Unicode and unusual-name rows exercise supported lexical comparison, not actual native filesystem occurrence.
 */
export function test_project_directory_exclusions_follow_compiler_case_policy(): void {
  const groups: readonly {
    readonly platform: NodeJS.Platform;
    readonly excluded: string;
    readonly rows: readonly (readonly [string, boolean, boolean, boolean])[];
  }[] = [
    {
      platform: "win32", excluded: "C:\\project\\Output",
      rows: [
        ["C:\\project\\Output\\main.ts", false, true, true],
        ["C:\\project\\Output\\main.ts", true, true, true],
        ["C:\\project\\output\\main.ts", false, false, true],
        ["C:\\project\\output\\main.ts", true, false, true],
        ["C:\\project\\Output", false, true, true],
        ["C:\\project\\Output", true, false, false],
        ["C:\\project\\output", false, false, true],
        ["C:\\project\\output", true, false, false],
        ["C:\\project\\Output\\", true, false, false],
        ["C:\\project\\OutputSibling\\main.ts", false, false, false],
        ["D:\\project\\Output\\main.ts", false, false, false],
      ],
    },
    {
      platform: "linux", excluded: "/project/Output",
      rows: [
        ["/project/Output/main.ts", false, true, true],
        ["/project/output/main.ts", false, false, true],
        ["/project/output/main.ts", true, false, true],
        ["/project/Output", false, true, true],
        ["/project/Output", true, false, false],
        ["/project/output", false, false, true],
        ["/project/output", true, false, false],
        ["/project/Output/", true, false, false],
        ["/project/OutputSibling/main.ts", false, false, false],
        ["/other/Output/main.ts", false, false, false],
        ["/project/Output\n/main.ts", false, false, false],
      ],
    },
    {
      platform: "linux", excluded: "/project/σ",
      rows: [
        ["/project/σ/main.ts", false, true, true],
        ["/project/ς/main.ts", false, false, true],
        ["/project/ς", false, false, true],
        ["/project/ς", true, false, false],
      ],
    },
    {
      platform: "win32", excluded: "C:\\project\\K",
      rows: [
        ["C:\\project\\K\\main.ts", false, false, true],
        ["C:\\project\\K", true, false, false],
      ],
    },
    {
      platform: "linux", excluded: "/project/ß",
      rows: [["/project/ss/main.ts", false, false, false]],
    },
    {
      platform: "linux", excluded: "/project/a[bc]+.$",
      rows: [
        ["/project/a[bc]+.$/main.ts", false, true, true],
        ["/project/abbbX/main.ts", false, false, false],
      ],
    },
    {
      platform: "linux", excluded: "/project/back\\slash",
      rows: [
        ["/project/back\\slash/main.ts", false, true, true],
        ["/project/back/slash/main.ts", false, false, false],
      ],
    },
    {
      platform: "linux", excluded: "/project/Output\n",
      rows: [
        ["/project/Output\n/main.ts", false, true, true],
        ["/project/Output\n", true, false, false],
        ["/project/Output/main.ts", false, false, false],
      ],
    },
    {
      platform: "linux", excluded: "/",
      rows: [
        ["/main.ts", false, true, true],
        ["/main.ts", true, true, true],
        ["/", false, true, true],
        ["/", true, false, false],
      ],
    },
    {
      platform: "win32", excluded: "C:\\",
      rows: [
        ["C:\\main.ts", false, true, true],
        ["C:\\", false, true, true],
        ["C:\\", true, false, false],
        ["D:\\main.ts", false, false, false],
      ],
    },
    {
      platform: "win32", excluded: "\\\\server\\share\\",
      rows: [
        ["\\\\server\\share\\main.ts", false, true, true],
        ["\\\\server\\share\\", false, true, true],
        ["\\\\server\\share\\", true, false, false],
        ["\\\\server\\shareOther\\main.ts", false, false, false],
        ["\\\\other\\share\\main.ts", false, false, false],
      ],
    },
  ];
  for (const { platform, excluded, rows } of groups) {
    for (const useCaseSensitiveFileNames of [true, false]) {
      const policy: ITtscProjectMembershipPolicy = Object.freeze({
        excludedDirectories: Object.freeze([excluded]),
        inputExtensions: Object.freeze([".ts"]),
        sources: Object.freeze([]),
        useCaseSensitiveFileNames,
      });
      for (const [location, strictly, sensitive, insensitive] of rows) {
        assert.equal(
          insideExcludedProjectDirectory(location, policy, strictly, platform),
          useCaseSensitiveFileNames ? sensitive : insensitive,
          JSON.stringify({ platform, excluded, useCaseSensitiveFileNames, location, strictly }),
        );
      }
      const empty: ITtscProjectMembershipPolicy = Object.freeze({
        ...policy,
        excludedDirectories: Object.freeze([]),
      });
      assert.equal(insideExcludedProjectDirectory(excluded, empty, false, platform), false);
    }
  }
}
