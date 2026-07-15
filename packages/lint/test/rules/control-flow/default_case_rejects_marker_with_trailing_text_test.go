package linthost

import "testing"

// TestDefaultCaseRejectsMarkerWithTrailingText verifies the anchored default pattern rejects extra words.
//
// DEFAULT_COMMENT_PATTERN is anchored (`^no default$`), so `// no default here`
// does not match and the omission stays unmarked. Boundary twin locking the
// anchors against a loose substring match.
//
// 1. Place `// no default here` as the trailing comment.
// 2. Run the engine with default-case enabled.
// 3. Assert exactly one finding at the switch statement (line 2).
func TestDefaultCaseRejectsMarkerWithTrailingText(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default here
}
`, "", 2)
}
