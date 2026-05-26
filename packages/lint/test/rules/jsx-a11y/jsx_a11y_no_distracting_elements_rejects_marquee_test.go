package linthost

import "testing"

// TestJsxA11yNoDistractingElementsRejectsMarquee verifies distracting tags are rejected.
//
// Legacy animated elements are intrinsic tags, so this rule should diagnose them
// without attribute or child inspection.
//
// 1. Parse a marquee element.
// 2. Enable only `jsx-a11y/no-distracting-elements`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yNoDistractingElementsRejectsMarquee(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/no-distracting-elements", `const Component = () => <marquee>Sale</marquee>;`, "distracting")
}
