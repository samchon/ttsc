package linthost

import "testing"

// TestFormatPrintWidthPreservesBlankLineInReflowedCallbackBody verifies
// the rule keeps a user-authored blank line inside a hugged callback
// body instead of deleting it.
//
// The formatPrintWidth print engine rebuilds a block body from fresh
// Hardline separators. Before the Literalline fix the rebuild collapsed
// every inter-statement blank line, so the first `ttsc format` pass
// silently rewrote a developer's spacing. With the fix the canonical
// blank-line shape is a fixed point: the rule renders it back
// byte-for-byte and reports no finding.
//
//  1. Feed a `new Singleton(() => { … })` whose body has a blank line
//     between two statements.
//  2. Run formatPrintWidth at the default width.
//  3. Assert the rule reports zero findings — the blank line survives.
func TestFormatPrintWidthPreservesBlankLineInReflowedCallbackBody(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "formatPrintWidth",
    "const x = new Singleton(() => {\n  setup();\n\n  teardown();\n});\n",
  )
}
