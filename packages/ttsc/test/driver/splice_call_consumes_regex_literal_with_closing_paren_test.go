package driver_test

import "testing"

// TestDriverSpliceCallConsumesRegexLiteralWithClosingParen Verifies regex
// literals do not terminate call scanning.
//
// The direct output owner receives a regular expression literal that
// contains a parenthesis character that looks like syntax but belongs to the
// literal body. The public runtime case separately owns actual compiler emission.
//
// 1. Splice a plugin call whose argument is a regex literal containing `)`.
// 2. Consume the call parentheses through the driver rewrite helper.
// 3. Assert only the intended call text is replaced.
//
// @evidence contracts/testing.md#behavioral-verification spliceForTest returns exactly const out = replacement when the consumed call contains a regex parenthesis and second argument.
// @evidence contracts/testing.md#independent-expectations The whole-call rewrite contract yields the literal complete statement; a parenthesis inside the regex body cannot close the argument list.
// @evidence contracts/testing.md#distinguishing-cases One escaped closing-parenthesis regex with a neighboring string argument owns regex consumption; division has a contrasting case.
// @evidence contracts/testing.md#execution-ownership The Go unit invokes actual applyRewrites through spliceForTest, which supplies a parsed filename identity and independently requires the real header marker before returning the call body for existing exact assertions. It starts no compiler host or runtime process.
func TestDriverSpliceCallConsumesRegexLiteralWithClosingParen(t *testing.T) {
  got := spliceForTest(t, `const out = plugin.make(/\)/, "ok");`)
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}
