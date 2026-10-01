package linthost

import (
  "strings"
  "testing"
)

// TestUnicornReportOnlyAdviceExposesSemanticPreconditions verifies that review
// advice preserves the preconditions omitted by a mechanical replacement.
// Global match resets lastIndex; unshift reverses call groups, not each group's
// values, and moving evaluations or receiver lookups can change behavior.
//
// 1. Run the actual rules on stateful and ordinary authored inputs.
// 2. Require their independent semantic warnings and no executable edits.
//
// @evidence contracts/testing.md#behavioral-verification Owning Engine findings expose lastIndex and unshift group-order warnings and retain byte-identical source without fixes or suggestions.
// @evidence contracts/testing.md#independent-expectations Authored warning phrases follow global RegExp state and Array unshift ordering rather than borrowing rule output.
// @evidence contracts/testing.md#distinguishing-cases Global match, ordinary exec, push and unshift retain advice while only unshift requires reversed call groups.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit executes both AST rules in one process without a producer, installation or child host.
func TestUnicornReportOnlyAdviceExposesSemanticPreconditions(t *testing.T) {
  cases := []struct {
    rule, source string
    warnings []string
    reverse bool
  }{
    {"unicorn/prefer-regexp-test", "const r=/a/g; r.lastIndex=1; if ('a'.match(r)) {}", []string{"method identity", "global/sticky `lastIndex`"}, false},
    {"unicorn/prefer-regexp-test", "if (/a/.exec(text)) {}", []string{"method identity", "global/sticky `lastIndex`"}, false},
    {"unicorn/prefer-single-call", "xs.push(1); xs.push(2,3);", []string{"method identity", "receiver stability", "argument evaluation"}, false},
    {"unicorn/prefer-single-call", "xs.unshift(1); xs.unshift(2,3);", []string{"method identity", "receiver stability", "argument evaluation", "preserving the order within each group"}, true},
  }
  for _, c := range cases {
    t.Run(c.source, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, c.rule, c.source, nil)
      if len(findings) != 1 { t.Fatalf("want one review finding, got %+v", findings) }
      for _, warning := range c.warnings {
        if !strings.Contains(findings[0].Message, warning) { t.Fatalf("missing %q in %q", warning, findings[0].Message) }
      }
      if strings.Contains(findings[0].Message, "Reverse the call argument groups") != c.reverse { t.Fatalf("wrong ordering advice: %q", findings[0].Message) }
      assertReportOnlySnapshot(t, c.rule, c.source)
    })
  }
}
