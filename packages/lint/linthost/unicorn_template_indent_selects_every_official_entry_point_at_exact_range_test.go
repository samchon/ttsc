package linthost

import (
  "strings"
  "testing"
)

// TestUnicornTemplateIndentSelectsEveryOfficialEntryPointAtExactRange verifies that the engine requires four ordinary errors with authored template offsets, full message and quasi fixes.
//
// Official upstream tag/function/comment/Jest selector semantics and the literal message independently establish the four report locations.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The engine requires four ordinary errors with authored template offsets, full message and quasi fixes.
// @evidence contracts/testing.md#independent-expectations Official upstream tag/function/comment/Jest selector semantics and the literal message independently establish the four report locations.
// @evidence contracts/testing.md#distinguishing-cases gql, stripIndent, HTML block comment and inline snapshot each retain a separate exact-range finding.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentSelectsEveryOfficialEntryPointAtExactRange owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentSelectsEveryOfficialEntryPointAtExactRange(t *testing.T) {
  source := "declare const value: unknown;\n" +
    "const tagged = gql`\none\n`;\n" +
    "const called = stripIndent(`\ntwo\n`);\n" +
    "const commented = /* html */ `\n<div>\n`;\n" +
    "expect(value).toMatchInlineSnapshot(`\nsnapshot\n`);\n"

  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornTemplateIndentRuleName, findings)
  if len(findings) != 4 {
    t.Fatalf("want four findings, got %d (%+v)", len(findings), findings)
  }
  starts := []int{
    strings.Index(source, "`\none"),
    strings.Index(source, "`\ntwo"),
    strings.Index(source, "`\n<div>"),
    strings.Index(source, "`\nsnapshot"),
  }
  for index, finding := range findings {
    if finding.Rule != unicornTemplateIndentRuleName {
      t.Fatalf("finding %d rule: want %q, got %q", index, unicornTemplateIndentRuleName, finding.Rule)
    }
    if finding.Message != "Templates should be properly indented." {
      t.Fatalf("finding %d message: want %q, got %q", index, "Templates should be properly indented.", finding.Message)
    }
    if finding.Pos != starts[index] {
      t.Fatalf("finding %d start: want %d, got %d", index, starts[index], finding.Pos)
    }
    if finding.End <= finding.Pos || source[finding.End-1] != '`' {
      t.Fatalf("finding %d range does not cover the complete template: [%d,%d)", index, finding.Pos, finding.End)
    }
    if len(finding.Fix) == 0 {
      t.Fatalf("finding %d must carry raw-quasi edits", index)
    }
  }
}
