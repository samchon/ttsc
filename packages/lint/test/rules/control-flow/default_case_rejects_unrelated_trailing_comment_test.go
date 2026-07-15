package linthost

import "testing"

// TestDefaultCaseRejectsUnrelatedTrailingComment verifies a non-marker trailing comment does not suppress the finding.
//
// Only a comment matching the pattern is a marker; an ordinary `// TODO` after
// the last clause still leaves the default omitted. Negative twin of the
// marker acceptance, one property away (the comment text changed).
//
// 1. Place `// TODO: handle the rest` as the trailing comment.
// 2. Run the engine with default-case enabled.
// 3. Assert exactly one finding at the switch statement (line 2).
func TestDefaultCaseRejectsUnrelatedTrailingComment(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // TODO: handle the rest
}
`, "", 2)
}
