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
}
