package linthost

import "testing"

// TestDefaultCaseAcceptsCaseInsensitiveMarker verifies the default marker matches regardless of letter case.
//
// DEFAULT_COMMENT_PATTERN carries the `i` flag, so `// NO DEFAULT` is as valid
// as the lowercase spelling. Locks the case-insensitivity of the ported
// default pattern.
//
// 1. Place `// NO DEFAULT` as the trailing comment.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
func TestDefaultCaseAcceptsCaseInsensitiveMarker(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // NO DEFAULT
}
`, "")
}
