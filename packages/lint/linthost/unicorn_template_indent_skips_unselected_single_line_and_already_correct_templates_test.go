package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentSkipsUnselectedSingleLineAndAlreadyCorrectTemplates verifies that the real engine requires zero findings for all eleven named skip shapes.
//
// The supported selection scope and unchanged-output rule independently leave nonmatches, single-line bodies and correct indentation alone.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The real engine requires zero findings for all eleven named skip shapes.
// @evidence contracts/testing.md#independent-expectations The supported selection scope and unchanged-output rule independently leave nonmatches, single-line bodies and correct indentation alone.
// @evidence contracts/testing.md#distinguishing-cases Single-line, unselected/computed/call-result tags, comment proximity/type, indirect function argument and both indentation-correct forms retain named identities.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentSkipsUnselectedSingleLineAndAlreadyCorrectTemplates owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentSkipsUnselectedSingleLineAndAlreadyCorrectTemplates(t *testing.T) {
  sources := []string{
    "const single = gql`one`;\n",
    "const unselected = other`\n        one\n        `;\n",
    "const computed = utils[\"dedent\"]`\n        one\n        `;\n",
    "const calledTag = makeTag()`\n        one\n        `;\n",
    "const lineComment = // indent\n`\n        one\n        `;\n",
    "const closerBlockCommentWins = /* indent */ /* other */ `\n        one\n        `;\n",
    "const closerLineCommentWins = /* indent */ // other\n`\n        one\n        `;\n",
    "const commentBeforeTagIsNotBeforeTemplate = /* indent */ other`\n        one\n        `;\n",
    "const nestedFunctionArgument = stripIndent([`\n        one\n        `]);\n",
    "if (ready) {\n  use();\n}\nconst correct = gql`\n  one\n    child\n`;\n",
    "const existingTemplateIndent = gql`\n        one\n        two\n`;\n",
  }
  for index, source := range sources {
    t.Run(unicornTemplateIndentSkipTestName(index), func(t *testing.T) {
      assertRuleSkipsSource(t, unicornTemplateIndentRuleName, source)
    })
  }
}
