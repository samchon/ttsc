package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentFixesNestedTemplatesWithoutTouchingExpressions verifies that the fixer compares nested-template output with an authored full source, parses it and requires no subsequent finding.
//
// An inner selected template may change its quasi whitespace without rewriting the enclosing substitution expression; the literal output independently preserves that distinction.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares nested-template output with an authored full source, parses it and requires no subsequent finding.
// @evidence contracts/testing.md#independent-expectations An inner selected template may change its quasi whitespace without rewriting the enclosing substitution expression; the literal output independently preserves that distinction.
// @evidence contracts/testing.md#distinguishing-cases The outer expression layout stays intact while the inner tagged body changes; ordinary multi-quasi preservation belongs to the adjacent fix host.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentFixesNestedTemplatesWithoutTouchingExpressions owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentFixesNestedTemplatesWithoutTouchingExpressions(t *testing.T) {
  source := "declare const ready: boolean;\n" +
    "declare const value: string;\n" +
    "declare function use(): void;\n" +
    "if (ready) {\n  use();\n}\n" +
    "const outer = outdent`\n" +
    "  before\n" +
    "  before${\n" +
    "\t\t\toutdent`\n" +
    "inner ${value}\n" +
    "\t\t\t`\n" +
    "}after\n" +
    "  after\n" +
    "`;\n"
  expected := "declare const ready: boolean;\n" +
    "declare const value: string;\n" +
    "declare function use(): void;\n" +
    "if (ready) {\n  use();\n}\n" +
    "const outer = outdent`\n" +
    "  before\n" +
    "  before${\n" +
    "\t\t\toutdent`\n" +
    "\t\t\t\tinner ${value}\n" +
    "\t\t\t`\n" +
    "}after\n" +
    "  after\n" +
    "`;\n"

  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  file := parseTSFile(t, "/virtual/fixed-nested-template.ts", expected)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixed nested source has parse diagnostics: %+v\n%s", diagnostics, expected)
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
