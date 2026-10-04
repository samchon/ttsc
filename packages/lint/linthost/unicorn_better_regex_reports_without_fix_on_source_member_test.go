package linthost

import "testing"

// TestUnicornBetterRegexReportsWithoutFixOnSourceMember verifies the rule
// reports, but declines to autofix, a literal used as the object of a
// non-optional `.source` or `.toString` member access.
//
// Rewriting `/[0-9]/.source` would change the string a consumer reads back, so
// this Go rule reports the optimization without attaching a fix. The guard is
// narrow: any other member (`.test`) or an optional-chained `?.source` still
// gets the fix, so those adjacent shapes are the negative twins that keep the
// exception from swallowing legitimate rewrites.
//
//  1. Assert `.source` / `.toString` objects report with no applied fix.
//  2. Assert `.test(...)` and `?.source` objects still rewrite.
//
// @evidence contracts/testing.md#behavioral-verification assertNoFixSnapshot reports but declines edits for nonoptional source/toString member reads, while exact fix snapshots rewrite test and optional source forms.
// @evidence contracts/testing.md#independent-expectations The authored outputs distinguish no automatic edits for nonoptional source/toString from exact rewrites for test/optional source; literal full-source equality is independent of product formatting.
// @evidence contracts/testing.md#distinguishing-cases Nonoptional source/toString are protected, but test and optional source remain fixable; changing only the member access changes edit eligibility.
// @evidence contracts/testing.md#execution-ownership These four source inputs execute in the same named Go unit entry; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
func TestUnicornBetterRegexReportsWithoutFixOnSourceMember(t *testing.T) {
  assertNoFixSnapshot(t, unicornBetterRegexRuleName, "const foo = /[0-9]/.source;\n")
  assertNoFixSnapshot(t, unicornBetterRegexRuleName, "const foo = /[0-9]/.toString;\n")

  assertFixSnapshot(
    t,
    unicornBetterRegexRuleName,
    "const foo = /[0-9]/.test(\"x\");\n",
    "const foo = /\\d/.test(\"x\");\n",
  )
  assertFixSnapshot(
    t,
    unicornBetterRegexRuleName,
    "const foo = /[0-9]/?.source;\n",
    "const foo = /\\d/?.source;\n",
  )
}
