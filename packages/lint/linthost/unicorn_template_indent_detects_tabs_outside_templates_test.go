package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentDetectsTabsOutsideTemplates verifies that the fixer compares an authored tab-indented output and requires it to remain clean.
//
// Supported indentation inference uses actual surrounding source indentation, independently requiring tabs while preserving interior relative spacing.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares an authored tab-indented output and requires it to remain clean.
// @evidence contracts/testing.md#independent-expectations Supported indentation inference uses actual surrounding source indentation, independently requiring tabs while preserving interior relative spacing.
// @evidence contracts/testing.md#distinguishing-cases A tab in ordinary source determines template indentation; explicit tab options and no-signal fallback belong to separate hosts.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentDetectsTabsOutsideTemplates owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentDetectsTabsOutsideTemplates(t *testing.T) {
  source := "if (ready) {\n\tuse();\n}\n\n" +
    "const query = html`\n" +
    "item\n" +
    "  child\n" +
    "`;\n"
  expected := "if (ready) {\n\tuse();\n}\n\n" +
    "const query = html`\n" +
    "\titem\n" +
    "\t  child\n" +
    "`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
