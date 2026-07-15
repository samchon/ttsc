package linthost

import "testing"

// TestDefaultCaseAcceptsBlockCommentMarker verifies a block-comment marker is honored.
//
// ESLint reads `comment.value` (delimiter-free) and trims it, so `/* no default */`
// carries the same `no default` value as the line form. Boundary twin of the
// line-comment marker covering the `/* */` delimiter stripping.
//
// 1. Place `/* no default */` as the trailing comment of the last clause.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
func TestDefaultCaseAcceptsBlockCommentMarker(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  /* no default */
}
`, "")
}
