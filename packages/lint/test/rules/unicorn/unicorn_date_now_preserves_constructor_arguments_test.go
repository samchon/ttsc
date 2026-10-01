package linthost

import "testing"

// TestUnicornDateNowPreservesConstructorArguments verifies a constructed date preserves the supplied time instead of reading the current clock.
//
// Explicit constructor arguments select an authored instant. Date.now only replaces the zero-argument current-time idiom.
//
// 1. Run the owning rule on the authored load-bearing arguments.
// 2. Require zero findings on those inputs.
// 3. Preserve report-only diagnostics for the adjacent ordinary idioms.
//
// @evidence contracts/testing.md#behavioral-verification Engine runs unicorn/prefer-date-now; zero-finding negatives distinguish the named argument boundary and report-only positives require activation without automatic edits.
// @evidence contracts/testing.md#independent-expectations Explicit constructor arguments select an authored instant. Date.now only replaces the zero-argument current-time idiom.
// @evidence contracts/testing.md#distinguishing-cases Numeric, textual and spread constructor arguments are excluded; zero-argument getTime, valueOf and unary-plus idioms retain report-only advice.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit uses the owning Engine and shared finding helpers in process without installation or a native host.
func TestUnicornDateNowPreservesConstructorArguments(t *testing.T) {
  for _, source := range []string{
    "const value = new Date(0).getTime();",
    "const value = new Date(0).valueOf();",
    "const value = +new Date(0);",
    "const value = new Date('2020-01-01').getTime();",
    "const value = new Date(...[]).getTime();",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/prefer-date-now", source) })
  }
  for _, source := range []string{
    "const value = new Date().getTime();",
    "const value = new Date().valueOf();",
    "const value = +new Date();",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/prefer-date-now", source) })
  }
}

