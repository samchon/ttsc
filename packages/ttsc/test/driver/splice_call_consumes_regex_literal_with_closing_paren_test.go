package driver_test

import "testing"

// TestDriverSpliceCallConsumesRegexLiteralWithClosingParen verifies regex
// literals do not terminate call scanning.
//
// The test binds to the private scanner because a regular expression literal
// may contain a parenthesis character that looks like syntax but belongs to the
// literal body, making the failure mode narrower than a full emit fixture.
//
// 1. Splice a plugin call whose argument is a regex literal containing `)`.
// 2. Consume the call parentheses through the driver rewrite helper.
// 3. Assert only the intended call text is replaced.
func TestDriverSpliceCallConsumesRegexLiteralWithClosingParen(t *testing.T) {
  got := spliceForTest(t, `const out = plugin.make(/\)/, "ok");`)
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}
