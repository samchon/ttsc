package linthost

import "testing"

// TestRuleCorpusPreferNamedCaptureGroup verifies the lint rule corpus
// fixture prefer-named-capture-group.ts.
//
// The rule fires on regex literals that contain a capturing group
// (`(…)`) without a name; the suggested replacement is the named-group
// form `(?<name>…)`. The fixture covers two positive cases plus the
// negatives: non-capturing groups, lookarounds, and `(` bytes that
// appear inside a character class.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports unnamed numeric and alternation captures but permits noncapturing/named groups, lookahead and parentheses in a class.
// @evidence contracts/testing.md#independent-expectations Only capturing groups require names; independently authored markers follow regex group syntax rather than substring parentheses.
// @evidence contracts/testing.md#distinguishing-cases Two capture positives and four syntax/context controls distinguish group kind and character-class contents.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase executes the embedded annotation fixture through the rule engine. This Test owns every literal expected diagnostic and every unmarked source control. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRuleCorpusPreferNamedCaptureGroup(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-named-capture-group.ts", "// Positive: a bare `(\\d+)` is an unnamed capture group.\n// expect: prefer-named-capture-group error\nconst yearOnly = /(\\d{4})/;\n\n// Positive: alternation inside a capturing group still flags — the\n// outer group lacks a name.\n// expect: prefer-named-capture-group error\nconst protocol = /(http|https):\\/\\//;\n\n// Negative: a non-capturing group `(?:…)` doesn't capture, so the rule\n// has no name to ask for.\nconst versionGroup = /(?:v?)\\d+/;\n\n// Negative: a named capture group is already the recommended form.\nconst namedYear = /(?<year>\\d{4})/;\n\n// Negative: a lookahead assertion `(?=…)` doesn't capture.\nconst lookahead = /foo(?=bar)/;\n\n// Negative: a character class containing `(` is a literal `(` byte,\n// not a group opener.\nconst literalParen = /[()]/;\n\nJSON.stringify({ yearOnly, protocol, versionGroup, namedYear, lookahead, literalParen });\n")
}
