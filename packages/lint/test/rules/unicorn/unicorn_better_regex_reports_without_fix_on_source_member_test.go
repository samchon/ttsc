package linthost

import "testing"

// TestUnicornBetterRegexReportsWithoutFixOnSourceMember verifies the rule
// reports, but declines to autofix, a literal used as the object of a
// non-optional `.source` or `.toString` member access.
//
// Rewriting `/[0-9]/.source` would change the string a consumer reads back, so
// upstream reports the optimization without attaching a fix. The guard is
// narrow: any other member (`.test`) or an optional-chained `?.source` still
// gets the fix, so those adjacent shapes are the negative twins that keep the
// exception from swallowing legitimate rewrites.
//
//  1. Assert `.source` / `.toString` objects report with no applied fix.
//  2. Assert `.test(...)` and `?.source` objects still rewrite.
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
