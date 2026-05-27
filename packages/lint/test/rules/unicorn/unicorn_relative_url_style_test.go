package linthost

import "testing"

// TestRuleCorpusUnicornRelativeUrlStyle verifies the rule reports a
// `new URL("./foo", base)` whose first argument starts with `./`.
//
// `new URL("./foo", base)` and `new URL("foo", base)` resolve to the
// same URL, so the leading `./` is redundant. The rule visits
// `KindNewExpression`, accepts the bare `URL` identifier callee, and
// fires on the literal argument when it starts with `./`. The fixture
// pins that exact shape.
//
// 1. Enable unicorn/relative-url-style via an expect annotation.
// 2. Construct `new URL("./foo", base)`.
// 3. Assert the string-literal argument is reported.
func TestRuleCorpusUnicornRelativeUrlStyle(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/relative-url-style.ts", "declare const base: string;\nconst u = new URL(\n  // expect: unicorn/relative-url-style error\n  \"./foo\",\n  base,\n);\nvoid u;\n")
}
