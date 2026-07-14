package linthost

import "testing"

// TestUnicornStringContentSelectorMatchesKeepIgnoredTagExemption verifies
// the foreign-language tag exemption survives explicit selectors.
//
// Upstream applies `isIgnoredTag` inside the shared `getProblem` visitor, so
// even a selector that deliberately targets tagged templates cannot opt an
// `html` quasi back in — this is the upstream suite's
// `TaggedTemplateExpression TemplateElement` case, where only the unlisted
// tag is rewritten.
//
//  1. Configure `selectors: ["TaggedTemplateExpression TemplateElement"]`.
//  2. Lint an `html` tagged template next to a `notIgnoredTag` one.
//  3. Assert only the unlisted tag's quasi is rewritten.
func TestUnicornStringContentSelectorMatchesKeepIgnoredTagExemption(t *testing.T) {
  source := "declare function html(strings: TemplateStringsArray): string;\n" +
    "declare function notIgnoredTag(strings: TemplateStringsArray): string;\n" +
    "const foo = html`<div>no</div>`;\n" +
    "const bar = notIgnoredTag`no`;\n"
  options := `{"patterns":{"no":"yes"},"selectors":["TaggedTemplateExpression TemplateElement"]}`
  expected := "declare function html(strings: TemplateStringsArray): string;\n" +
    "declare function notIgnoredTag(strings: TemplateStringsArray): string;\n" +
    "const foo = html`<div>no</div>`;\n" +
    "const bar = notIgnoredTag`yes`;\n"
  assertFixSnapshotWithOptions(t, "unicorn/string-content", source, options, expected)
}
