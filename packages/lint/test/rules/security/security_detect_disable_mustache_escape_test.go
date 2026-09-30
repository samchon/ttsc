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
//
// @evidence contracts/testing.md#behavioral-verification The detect-disable-mustache-escape rule reports a false assignment to view.escapeMarkup without treating a bare escapeMarkup binding as a template engine property.
// @evidence contracts/testing.md#independent-expectations The independently annotated property assignment disables escaping; the unrelated local assignment does not establish that API operation.
// @evidence contracts/testing.md#distinguishing-cases Contrasts the bare identifier and member target with the same false value, detecting overbroad name matching.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs this entry's embedded source through the enabled security rule and compares independently authored expect annotations with normalized rule/severity/line triples. This Test owns its marked sink and any unmarked control; all parser/engine work stays in the Go process.
func TestSecurityDetectDisableMustacheEscape(t *testing.T) {
  assertRuleCorpusCase(t, "security/detect-disable-mustache-escape.ts", `
escapeMarkup = false;
// expect: security/detect-disable-mustache-escape error
view.escapeMarkup = false;
`)
}
