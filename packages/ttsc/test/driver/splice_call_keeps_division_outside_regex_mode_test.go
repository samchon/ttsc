package driver_test

import "testing"

// TestDriverSpliceCallKeepsDivisionOutsideRegexMode verifies division
// operators are not parsed as regex literals.
//
// The scanner distinguishes slash tokens that start regular expressions from
// slash tokens that divide expressions. Division must stay in normal expression
// mode so the following comma and closing parenthesis are handled correctly.
//
// This scenario exercises the non-regex slash path through the splice helper.
// It preserves coverage for a subtle lexer boundary without relocating the
// test back into the production driver package.
//
// 1. Splice a plugin call whose first argument uses division.
// 2. Consume the call parentheses through the driver rewrite helper.
// 3. Assert the division expression does not prevent full-call replacement.
func TestDriverSpliceCallKeepsDivisionOutsideRegexMode(t *testing.T) {
	got := spliceForTest(t, `const out = plugin.make(total / divisor, 2);`)
	want := `const out = replacement;`
	if got != want {
		t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
	}
}
