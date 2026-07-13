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
}
