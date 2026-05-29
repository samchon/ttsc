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
func TestRuleCorpusPreferNamedCaptureGroup(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-named-capture-group.ts", "// Positive: a bare `(\\d+)` is an unnamed capture group.\n// expect: prefer-named-capture-group error\nconst yearOnly = /(\\d{4})/;\n\n// Positive: alternation inside a capturing group still flags — the\n// outer group lacks a name.\n// expect: prefer-named-capture-group error\nconst protocol = /(http|https):\\/\\//;\n\n// Negative: a non-capturing group `(?:…)` doesn't capture, so the rule\n// has no name to ask for.\nconst versionGroup = /(?:v?)\\d+/;\n\n// Negative: a named capture group is already the recommended form.\nconst namedYear = /(?<year>\\d{4})/;\n\n// Negative: a lookahead assertion `(?=…)` doesn't capture.\nconst lookahead = /foo(?=bar)/;\n\n// Negative: a character class containing `(` is a literal `(` byte,\n// not a group opener.\nconst literalParen = /[()]/;\n\nJSON.stringify({ yearOnly, protocol, versionGroup, namedYear, lookahead, literalParen });\n")
}
