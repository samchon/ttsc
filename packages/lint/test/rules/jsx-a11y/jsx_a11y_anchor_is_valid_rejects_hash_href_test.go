package linthost

import "testing"

// TestJsxA11yAnchorIsValidRejectsHashHref verifies placeholder hrefs are rejected.
//
// The native rule intentionally handles the high-confidence invalid targets that
// do not require router or component settings: empty, hash-only, and javascript URLs.
//
// 1. Parse an anchor whose href is `#`.
// 2. Enable only `jsx-a11y/anchor-is-valid`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAnchorIsValidRejectsHashHref(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-is-valid", `const Component = () => <a href="#">Home</a>;`, "href")
}
