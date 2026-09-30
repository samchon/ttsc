package linthost

import "testing"

// TestFormatIndentCedesBodyUnderMultilineArrowHead verifies format/indent
// does NOT de-indent a block body whose enclosing block opens on a wrapped
// continuation line. The curried arrow's `): void => {` head sits
// at a non-zero indent. The body hangs under that head's indent, not under
// depth*tabWidth from column 0, so format/indent must cede. It previously
// de-indented the correctly-indented `if`/`injectHook` lines, corrupting
// Prettier-canonical input.
//
//  1. Parse a curried arrow with a correctly-indented multi-line body.
//  2. Run format/indent.
//  3. Assert the rule reports nothing (the source is already correct).
//
// @evidence contracts/testing.md#behavioral-verification format/indent must return no findings for the correctly laid-out curried arrow body and its nested if. The no-finding assertion catches depth-based de-indentation of a continuation-owned body or its inner block.
// @evidence contracts/testing.md#independent-expectations The supported formatter ownership policy leaves chained and wrapped arrow indentation to the continuation layout. The authored body, condition, injectHook call and closing columns remain unchanged expected source rather than reconstructed depth results.
// @evidence contracts/testing.md#distinguishing-cases The negative includes a generic outer arrow, a wrapped inner arrow header and nested multiline if. StillFixesSingleLineHeadArrowBody supplies an ordinary one-head arrow positive so ceding every arrow would fail the family.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentCedesBodyUnderMultilineArrowHead owns its parsed source and no-finding oracle in the public Go unit population. The syntax-only owning operation runs in process without a consumer install, native artifact build or real product host.
func TestFormatIndentCedesBodyUnderMultilineArrowHead(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/indent",
    "export const createHook =\n"+
      "  <T extends Function = () => any>(lifecycle: LifecycleHooks) =>\n"+
      "  (\n"+
      "    hook: T,\n"+
      "  ): void => {\n"+
      "    if (\n"+
      "      a ||\n"+
      "      b\n"+
      "    ) {\n"+
      "      injectHook(c)\n"+
      "    }\n"+
      "  }\n",
    `{"tabWidth":2}`,
  )
}
