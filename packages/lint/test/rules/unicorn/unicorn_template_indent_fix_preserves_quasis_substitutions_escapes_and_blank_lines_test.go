package linthost

import (
  "strings"
  "testing"
)

// TestUnicornTemplateIndentFixPreservesQuasisSubstitutionsEscapesAndBlankLines verifies that the real fixer checks three quasi edits, no substitution overlap, authored full output, parsing and clean re-lint.
//
// Template substitutions and raw escapes must remain unchanged while whitespace indentation changes; independently authored source specifies both transformed and preserved meaning.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The real fixer checks three quasi edits, no substitution overlap, authored full output, parsing and clean re-lint.
// @evidence contracts/testing.md#independent-expectations Template substitutions and raw escapes must remain unchanged while whitespace indentation changes; independently authored source specifies both transformed and preserved meaning.
// @evidence contracts/testing.md#distinguishing-cases Two substitutions, escaped newline/backtick text, interior indentation and blank lines retain their exact output and edit boundaries.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentFixPreservesQuasisSubstitutionsEscapesAndBlankLines owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentFixPreservesQuasisSubstitutionsEscapesAndBlankLines(t *testing.T) {
  source := "declare const value: string;\n" +
    "declare const other: string;\n" +
    "const query = gql`\n" +
    "        one ${value /* keep */}\n" +
    "          two \\n \\` literal ${other}\n" +
    "          three\n" +
    "        \n" +
    "        four\n" +
    "        `;\n"
  expected := "declare const value: string;\n" +
    "declare const other: string;\n" +
    "const query = gql`\n" +
    "  one ${value /* keep */}\n" +
    "    two \\n \\` literal ${other}\n" +
    "    three\n" +
    "\n" +
    "  four\n" +
    "`;\n"

  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornTemplateIndentRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
  }
  expressions := []string{"${value /* keep */}", "${other}"}
  if len(findings[0].Fix) != 3 {
    t.Fatalf("two-substitution template must expose three quasi edits, got %+v", findings[0].Fix)
  }
  for _, expression := range expressions {
    expressionStart := strings.Index(source, expression)
    if expressionStart < 0 {
      t.Fatalf("substitution oracle %q is missing", expression)
    }
    expressionEnd := expressionStart + len(expression)
    for _, edit := range findings[0].Fix {
      if edit.Pos < expressionEnd && edit.End > expressionStart {
        t.Fatalf("quasi edit [%d,%d) overlaps substitution %q at [%d,%d)", edit.Pos, edit.End, expression, expressionStart, expressionEnd)
      }
    }
  }

  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  file := parseTSFile(t, "/virtual/fixed-template.ts", expected)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, expected)
  }
  if !strings.Contains(expected, "${value /* keep */}") || !strings.Contains(expected, "${other}") ||
    !strings.Contains(expected, "\\n \\` literal") {
    t.Fatal("test oracle must retain substitution and raw escape spelling")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
