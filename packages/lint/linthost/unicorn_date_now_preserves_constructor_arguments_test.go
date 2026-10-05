package linthost

import "testing"

// TestUnicornDateNowPreservesConstructorArguments checks that the rule excludes syntactically supplied arguments and reports only the authored zero-argument idioms.
//
// Numeric/textual arguments can select a supplied instant; a spread can yield zero or more values, so the rule conservatively excludes it by syntax. The independent expectation reports the authored zero-argument idioms; no Date constructor or clock executes here.
//
// 1. Run the owning rule on the authored load-bearing arguments.
// 2. Require zero findings on those inputs.
// 3. Preserve report-only diagnostics for the adjacent ordinary idioms.
//
// @evidence contracts/testing.md#behavioral-verification Engine runs unicorn/prefer-date-now; zero-finding negatives distinguish the named argument boundary and report-only positives require activation without automatic edits.
// @evidence contracts/testing.md#independent-expectations Numeric/textual arguments can select a supplied instant; a spread can yield zero or more values, so the rule conservatively excludes it by syntax. The independent expectation reports the authored zero-argument idioms; no Date constructor or clock executes here.
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
