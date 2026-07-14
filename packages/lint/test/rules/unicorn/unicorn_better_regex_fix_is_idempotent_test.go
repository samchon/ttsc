package linthost

import "testing"

// TestUnicornBetterRegexFixIsIdempotent verifies applying the fix yields a
// literal the rule no longer flags — the optimizer reached a stable fixed
// point.
//
// A fix that produced non-canonical output would re-report on its own result,
// looping `ttsc fix`. Feeding the rewritten source back through the rule and
// requiring zero findings proves the emitted form is already optimal for both
// a literal and a `new RegExp` constructor argument.
//
//  1. Fix an optimizable literal and a constructor pattern.
//  2. Re-lint each rewritten source and assert no further diagnostics.
func TestUnicornBetterRegexFixIsIdempotent(t *testing.T) {
  for _, source := range []string{
    "const foo = /[A-Za-z0-9_]+[0-9]?\\.[A-Za-z0-9_]*/;\n",
    "const foo = new RegExp('[0-9]');\n",
  } {
    fixed, applied := runFixSnapshot(t, unicornBetterRegexRuleName, source)
    if applied == 0 {
      t.Fatalf("expected a fix for %q", source)
    }
    _, _, findings := runRuleFindingsSnapshot(t, unicornBetterRegexRuleName, fixed, nil)
    if len(findings) != 0 {
      t.Fatalf("fixed source %q still reports %d findings: %+v", fixed, len(findings), findings)
    }
  }
}
