package linthost

import (
  "strings"
  "testing"
)

// TestPreferConstCountsWriteFormsBySymbol verifies every reassignment surface.
//
// Compound and update expressions, destructuring targets, loop targets, and
// closure writes must all disqualify only the symbol they resolve to. A stable
// sibling remains the positive control for over-suppression.
//
//  1. Reassign separate `let` bindings through each supported write shape.
//  2. Keep one initialized binding unchanged beside the negative controls.
//  3. Assert the unchanged binding produces the sole finding.
//
// @evidence contracts/testing.md#behavioral-verification The command must report only stable at 1:5, retaining existing count, status and stdout assertions while rejecting findings substituted onto mutable siblings.
// @evidence contracts/testing.md#independent-expectations The literal stable identifier site is authored from the fixture: every other initialized candidate is visibly reassigned by compound, update, destructuring, loop or closure writes.
// @evidence contracts/testing.md#distinguishing-cases Five write surfaces remain mutable beside the stable binding; the exact identifier oracle distinguishes a missed write from over-suppression with the same finding count.
// @evidence contracts/testing.md#execution-ownership TestPreferConstCountsWriteFormsBySymbol seedLintProject writes a temp tsconfig project and the in-process run(check) command loads a real Program and Checker with only prefer-const enabled; the test requires exit code 2, empty stdout and one rendered [prefer-const] error, and compares its line:column site with assertBindingDiagnosticSites. No consumer install, native build or product host runs.
func TestPreferConstCountsWriteFormsBySymbol(t *testing.T) {
  root := seedLintProject(t, `let stable = 1;

let compound = 0;
compound += 1;

let updated = 0;
updated++;

let arrayLeft = 1;
let arrayRight = 2;
[arrayLeft, arrayRight] = [arrayRight, arrayLeft];

let objectTarget = 0;
({ objectTarget } = { objectTarget: 1 });

let loopTarget = 0;
for (loopTarget of [1, 2]) {
  console.log(loopTarget);
}

let captured = 0;
const increment = (): number => ++captured;

console.log(stable, compound, updated, arrayLeft, arrayRight, objectTarget, increment());
`)
  seedLintRules(t, root, map[string]string{"prefer-const": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[prefer-const]") != 1 {
    t.Fatalf("prefer-const write-form diagnostics mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertBindingDiagnosticSites(t, stderr, [][2]int{{1, 5}})
}
