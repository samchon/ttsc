package linthost

import "testing"

// TestDefaultCaseAcceptsEmptySwitch verifies an empty switch produces nothing.
//
// Upstream `default-case` bails on `if (!node.cases.length) return;`: an empty
// case block has no clause to hang a `// no default` marker on, so ESLint
// leaves it alone. Locks the empty-switch boundary that the pre-fix port
// wrongly reported.
//
// 1. Build `switch (foo) {}` with zero clauses.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
func TestDefaultCaseAcceptsEmptySwitch(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
}
`, "")
}
