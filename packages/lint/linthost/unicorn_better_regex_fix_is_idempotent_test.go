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
//
// @evidence contracts/testing.md#behavioral-verification runFixSnapshot and re-lint preserve both original optimizer fixed-point probes; added exact source comparisons verify the intended literal and constructor outputs.
// @evidence contracts/testing.md#independent-expectations The independently authored word/digit shorthand and escaped constructor-string outputs establish correctness beyond idempotency.
// @evidence contracts/testing.md#distinguishing-cases Both a complex regex literal and single-quoted RegExp string must change to the authored outputs and stop reporting; canonical and Unicode exclusions have their dedicated neighboring tests.
// @evidence contracts/testing.md#execution-ownership Both probes execute inside this named Go unit entry without a product process; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
func TestUnicornBetterRegexFixIsIdempotent(t *testing.T) {
  assertFixSnapshot(t, unicornBetterRegexRuleName, "const foo = /[A-Za-z0-9_]+[0-9]?\\.[A-Za-z0-9_]*/;\n", "const foo = /\\w+\\d?\\.\\w*/;\n")
  assertFixSnapshot(t, unicornBetterRegexRuleName, "const foo = new RegExp('[0-9]');\n", "const foo = new RegExp('\\\\d');\n")
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
