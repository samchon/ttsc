package linthost

import "testing"

// TestFixNoVarSkipsCrossScopeSameNameOverDecline documents the deliberate
// conservative trade in the redesigned single-binding gate.
//
// `var x = 1;` at top level and the unrelated parameter `x` of `function g(x)`
// are in DIFFERENT scopes, so rewriting the top-level `var` to `let` would be
// perfectly legal. The gate has no scope engine, so it counts every binding
// position of `x` across the whole file (here: two — the var and the
// parameter) and declines. This over-decline costs one missed fix but can
// never corrupt source, which is the explicit design choice that replaced the
// piecemeal redeclaration scans. The diagnostic still fires.
//
//  1. Parse a top-level `var x` plus an unrelated `function g(x) {}`.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsCrossScopeSameNameOverDecline(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nfunction g(x) {\n  return x;\n}\nJSON.stringify([x, g(2)]);\n",
  )
}
