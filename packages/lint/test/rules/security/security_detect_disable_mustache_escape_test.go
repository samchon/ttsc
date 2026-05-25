package linthost

import "testing"

// TestSecurityDetectDisableMustacheEscape verifies security rule: escapeMarkup false is rejected.
//
// Template engines that expose `escapeMarkup` can disable HTML escaping through
// an ordinary property assignment, so the rule pins that assignment shape.
//
// 1. Assign a bare variable named `escapeMarkup`.
// 2. Assign `false` to an object's `escapeMarkup` property.
// 3. Assert only the property assignment is reported.
func TestSecurityDetectDisableMustacheEscape(t *testing.T) {
	assertRuleCorpusCase(t, "security/detect-disable-mustache-escape.ts", `
escapeMarkup = false;
// expect: security/detect-disable-mustache-escape error
view.escapeMarkup = false;
`)
}
