package linthost

import "testing"

// TestBanTsCommentIgnoresProseAndNearMissComments verifies non-directive
// comments never match, even when they mention directives.
//
// The compiler's directive grammar anchors `@ts-` right after the comment
// delimiters (plus whitespace), so prose mentions mid-comment, truncated
// directive names, and text before the `@` are all negative controls.
// Over-matching any of these would ban ordinary documentation.
//
//  1. Lint upstream's "just a comment containing ..." valid cases plus
//     near-miss spellings.
//  2. Assert zero findings for each under the recommended defaults.
//
// @evidence contracts/testing.md#behavioral-verification The rule ignores prose mentions and incomplete or misspelled directive names.
// @evidence contracts/testing.md#independent-expectations Only recognized directive-leading syntax changes compiler checking; seven authored non-directives independently require zero findings.
// @evidence contracts/testing.md#distinguishing-cases Embedded mentions, incomplete ts prefixes, preceding prose and typescript-ignore prevent substring-based false positives.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes every authored near-miss source; this Test owns all loop iterations. No consumer install or native product-host build/launch is used.
func TestBanTsCommentIgnoresProseAndNearMissComments(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  for _, source := range []string{
    "// just a comment containing @ts-expect-error somewhere\nconst a = 1;\nJSON.stringify(a);\n",
    "// just a comment containing @ts-ignore somewhere\nconst a = 1;\nJSON.stringify(a);\n",
    "// just a comment containing @ts-nocheck somewhere\nconst a = 1;\nJSON.stringify(a);\n",
    "// @ts-\nconst a = 1;\nJSON.stringify(a);\n",
    "// @ts-expect\nconst a = 1;\nJSON.stringify(a);\n",
    "// v @ts-ignore\nconst a = 1;\nJSON.stringify(a);\n",
    "// @typescript-ignore\nconst a = 1;\nJSON.stringify(a);\n",
  } {
    assertRuleSkipsSource(t, ruleName, source)
  }
}
