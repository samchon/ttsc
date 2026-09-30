package linthost

import (
  "testing"
)

const unicornTemplateIndentRuleName = "unicorn/template-indent"

// TestRuleCorpusUnicornTemplateIndent verifies that the actual engine compares the annotated multiline sql template with its indentation diagnostic.
//
// The supported default sql selector and two-space indentation policy independently require the literal corpus report.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The actual engine compares the annotated multiline sql template with its indentation diagnostic.
// @evidence contracts/testing.md#independent-expectations The supported default sql selector and two-space indentation policy independently require the literal corpus report.
// @evidence contracts/testing.md#distinguishing-cases The original selected multiline template reports; unselected/single-line/already-correct controls belong to the skip host.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornTemplateIndent owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestRuleCorpusUnicornTemplateIndent(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/template-indent.ts", `declare function sql(strings: TemplateStringsArray): string;

// expect: unicorn/template-indent error
const query = sql`+"`"+`
SELECT *
  FROM users
`+"`"+`;
`)
}



















func unicornTemplateIndentSkipTestName(index int) string {
  names := []string{
    "single-line",
    "unselected-tag",
    "computed-tag",
    "call-result-tag",
    "line-comment",
    "closer-block-comment",
    "closer-line-comment",
    "comment-before-tag",
    "non-direct-function-argument",
    "already-correct",
    "existing-template-indent-fallback",
  }
  return names[index]
}


