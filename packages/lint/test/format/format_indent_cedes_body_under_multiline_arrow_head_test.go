package linthost

import "testing"

// TestFormatIndentCedesBodyUnderMultilineArrowHead verifies format/indent
// does NOT de-indent a block body whose enclosing block opens on a wrapped
// continuation line — here a curried arrow whose `): void => {` head sits
// at a non-zero indent. The body hangs under that head's indent, not under
// depth*tabWidth from column 0, so format/indent must cede. It previously
// de-indented the correctly-indented `if`/`injectHook` lines, corrupting
// Prettier-canonical input.
//
//  1. Parse a curried arrow with a correctly-indented multi-line body.
//  2. Run format/indent.
//  3. Assert the rule reports nothing (the source is already correct).
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
