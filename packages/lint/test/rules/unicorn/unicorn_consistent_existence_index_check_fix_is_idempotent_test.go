package linthost

import "testing"

// TestUnicornConsistentExistenceIndexCheckFixIsIdempotent verifies the fixed
// source reaches a stable fixed point: re-linting it reports nothing.
//
// The rule rewrites one comparison into another comparison on the very same
// binding, so a wrong output operator or a stale literal would make the rule
// re-report its own emission and loop `ttsc fix`. Feeding each rewritten source
// back through the rule and requiring zero findings proves `=== -1` / `!== -1`
// are terminal for all three magnitude arms.
//
//  1. Fix `< 0`, `>= 0`, and `> -1` on a const-bound index.
//  2. Re-lint each rewritten source.
//  3. Assert no further diagnostics and no further edits.
func TestUnicornConsistentExistenceIndexCheckFixIsIdempotent(t *testing.T) {
  const ruleName = "unicorn/consistent-existence-index-check"
  for _, source := range []string{
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index < 0);\n",
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index >= 0);\n",
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index > -1);\n",
  } {
    fixed, applied := runFixSnapshot(t, ruleName, source)
    if applied == 0 {
      t.Fatalf("expected a fix for %q", source)
    }
    _, _, findings := runRuleFindingsSnapshot(t, ruleName, fixed, nil)
    if len(findings) != 0 {
      t.Fatalf("fixed source %q still reports %d findings: %+v", fixed, len(findings), findings)
    }
  }
}
