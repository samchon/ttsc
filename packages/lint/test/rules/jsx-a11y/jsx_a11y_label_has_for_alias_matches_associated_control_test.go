package linthost

import "testing"

// TestJsxA11yLabelHasForAliasMatchesAssociatedControl verifies the legacy label rule aliases behavior.
//
// `label-has-for` is retained for compatibility with eslint-plugin-jsx-a11y
// configurations and should report the same static missing-association case.
//
// 1. Parse a label with no htmlFor/for and no nested control.
// 2. Enable only `jsx-a11y/label-has-for`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yLabelHasForAliasMatchesAssociatedControl(t *testing.T) {
	assertJsxA11yRuleFinds(t, "jsx-a11y/label-has-for", `const Component = () => <label>Email</label>;`, "control")
}
