package driver_test

import "testing"

// TestDriverSpliceCallKeepsDivisionOutsideRegexMode Verifies division
// operators are not parsed as regex literals.
//
// This scenario exercises division parsing through the actual output owner
// because division must stay in normal expression mode so the following comma
// and closing parenthesis are handled correctly.
//
// 1. Splice a plugin call whose first argument uses division.
// 2. Consume the call parentheses through the driver rewrite helper.
// 3. Assert the division expression does not prevent full-call replacement.
//
// @evidence contracts/testing.md#behavioral-verification spliceForTest returns exactly const out = replacement for a call whose first argument is total divided by divisor.
// @evidence contracts/testing.md#independent-expectations The slash is division in the authored expression, so the real comma and closing parenthesis must remain available to whole-call consumption.
// @evidence contracts/testing.md#distinguishing-cases A division argument plus a second numeric argument contrasts with the regex-literal case.
// @evidence contracts/testing.md#execution-ownership The Go unit invokes actual applyRewrites through spliceForTest, which supplies a parsed filename identity and independently requires the real header marker before returning the call body for existing exact assertions. It starts no compiler host or runtime process.
func TestDriverSpliceCallKeepsDivisionOutsideRegexMode(t *testing.T) {
  got := spliceForTest(t, `const out = plugin.make(total / divisor, 2);`)
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}
