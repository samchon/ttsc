package linthost

import (
  "sort"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestJSDocCheckTagNamesPublishesCanonicalHints verifies the built-in
// validator also supplies the exact tag vocabulary it accepts to editors.
//
// The map is the rule's source of truth, so copying it into a second fixture
// would let validation and completion drift together unnoticed. The assertion
// derives the expected order from that map, then pins the JSDoc trigger and the
// existing type, empty, and synonym classifications used as item detail.
//
//  1. Evaluate the globally enabled rule through its project companion.
//  2. Collect the finished hint corpus through the host gate.
//  3. Compare every sorted item with the validator's canonical tag tables.
//
// @evidence contracts/testing.md#behavioral-verification evaluateProject and collectProjectHints verify the active validator publishes sorted JSDoc hints, @ triggers, classifications and its complete table-to-hint correspondence; real validation also accepts param and rejects parm.
// @evidence contracts/testing.md#independent-expectations Literal expectedDetails independently pins alpha as an ordinary tag, inheritDoc as empty, method as a function alias and param as typed. The complete table/detail equality is only an adapter consistency check and cannot independently detect an incorrect canonical vocabulary or every incorrect classification; the accepted/rejected tag source adds an independent parameter spelling oracle.
// @evidence contracts/testing.md#distinguishing-cases Four distinct detail meanings and complete ordered emission are checked; @param is the accepted spelling and @parm its rejected adjacent typo. Other documentation-tag rules own content requirements.
// @evidence contracts/testing.md#execution-ownership TestJSDocCheckTagNamesPublishesCanonicalHints is a named Go unit exercising actual project hint collection and source validation in one shared test process; its table consistency check concerns produced editor output, not committed source arrangement.
func TestJSDocCheckTagNamesPublishesCanonicalHints(t *testing.T) {
  const name = "jsdoc/check-tag-names"
  engine := NewEngine(RuleConfig{name: SeverityWarn})
  cycle := engine.evaluateProject(publicrule.ProjectIdentity{}, nil, nil)
  hints := collectProjectHints(cycle)

  tags := make([]string, 0, len(knownJSDocTags))
  for tag := range knownJSDocTags {
    tags = append(tags, tag)
  }
  sort.Strings(tags)
  if len(hints) != len(tags) {
    t.Fatalf("want %d known-tag hints, got %d: %#v", len(tags), len(hints), hints)
  }
  details := make(map[string]string, len(hints))
  for index, tag := range tags {
    hint := hints[index]
    if hint.Insert != tag || hint.Label != "" || hint.Detail != jsdocTagHintDetail(tag) ||
      hint.Trigger.Scope != publicrule.HintScopeJSDoc || hint.Trigger.After != "@" {
      t.Fatalf("hint %d for %q does not match the rule corpus: %#v", index, tag, hint)
    }
    details[tag] = hint.Detail
  }
  expectedDetails := map[string]string{
    "alpha":      "JSDoc tag",
    "inheritDoc": "no content",
    "method":     "alias for @function",
    "param":      "accepts a type",
  }
  for tag, expected := range expectedDetails {
    if detail := details[tag]; detail != expected {
      t.Fatalf("%q detail: want %q, got %q", tag, expected, detail)
    }
  }
  assertJSDocRuleLines(t, name, "/**\n * Handles the input.\n * @param value Input value.\n */\nexport function handle(value: unknown): unknown { return value; }\n")
  assertJSDocRuleLines(t, name, "/**\n * Handles the input.\n * @parm value Input value.\n */\nexport function handle(value: unknown): unknown { return value; }\n", 3)
}
