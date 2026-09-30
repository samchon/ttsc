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
//
// @evidence contracts/testing.md#behavioral-verification no-var deliberately declines top-level x when an unrelated function parameter also binds x.
// @evidence contracts/testing.md#independent-expectations The unchanged source and zero fixes pin the supported conservative file-wide name-count policy, without claiming the rewrite itself is unsafe.
// @evidence contracts/testing.md#distinguishing-cases Distinct scopes still over-decline under this AST-local policy; a truly unique name fixes in the companion positive case.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsCrossScopeSameNameOverDecline calls assertNoFixSnapshot for top-level x and g(x).
func TestFixNoVarSkipsCrossScopeSameNameOverDecline(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var x = 1;\nfunction g(x) {\n  return x;\n}\nJSON.stringify([x, g(2)]);\n",
  )
}
