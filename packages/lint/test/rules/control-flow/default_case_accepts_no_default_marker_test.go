package linthost

import "testing"

// TestDefaultCaseAcceptsNoDefaultMarker verifies the // no default marker suppresses the finding.
//
// ESLint accepts a trailing comment whose trimmed text matches
// DEFAULT_COMMENT_PATTERN (`/^no default$/iu`) as an explicit statement that
// the omitted default is intentional. Locks the marker-scan path the pre-fix
// port never implemented despite its header claim.
//
// 1. Place `// no default` as the last comment before the case block's `}`.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
func TestDefaultCaseAcceptsNoDefaultMarker(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default
}
`, "")
}
