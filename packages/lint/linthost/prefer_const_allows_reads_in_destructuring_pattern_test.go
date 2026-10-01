package linthost

import (
  "strings"
  "testing"
)

// TestPreferConstAllowsReadsInDestructuringPattern verifies only write targets constrain conversion.
//
// Member access in a computed property key or default expression is a read,
// not a non-identifier assignment target. Both declaration-only bindings can
// therefore still establish their sole value through the destructuring.
//
//  1. Assign two declaration-only bindings through computed-key and default patterns.
//  2. Put member access in the read-only portion of each pattern.
//  3. Assert both bindings are reported and no read is mistaken for a target.
//
// @evidence contracts/testing.md#behavioral-verification The owning command with a real Checker reports exactly the computed and defaulted target identifier sites, retaining status and empty stdout assertions.
// @evidence contracts/testing.md#independent-expectations Authored sites 5:20 and 8:12 identify sole writes to declaration-only let bindings; member reads in key/default expressions do not mutate those targets.
// @evidence contracts/testing.md#distinguishing-cases Computed keys and default expressions both contain member reads but permit conversion. The write-forms test owns actual destructuring reassignments.
// @evidence contracts/testing.md#execution-ownership TestPreferConstAllowsReadsInDestructuringPattern seedLintProject writes a temp tsconfig project and the in-process run(check) command loads a real Program and Checker with only prefer-const enabled; the test requires exit code 2, empty stdout, two rendered [prefer-const] errors, and compares their line:column sites with assertBindingDiagnosticSites. No consumer install, native build or product host runs.
func TestPreferConstAllowsReadsInDestructuringPattern(t *testing.T) {
  root := seedLintProject(t, `const input = { first: 1, second: 2 };
const keys = { current: "first" as const };

let computed: number;
({ [keys.current]: computed } = input);

let defaulted: number;
({ second: defaulted = input.second } = {} as Partial<typeof input>);

console.log(computed, defaulted);
`)
  seedLintRules(t, root, map[string]string{"prefer-const": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[prefer-const]") != 2 {
    t.Fatalf("prefer-const destructuring-read diagnostics mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertBindingDiagnosticSites(t, stderr, [][2]int{{5, 20}, {8, 12}})
}
