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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a relative URL segment redundantly starts with ./; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/relative-url-style annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same relative segment omits the redundant ./ prefix. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornRelativeUrlStyle is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornRelativeUrlStyle(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/relative-url-style.ts", "declare const base: string;\nconst u = new URL(\n  // expect: unicorn/relative-url-style error\n  \"./foo\",\n  base,\n);\nvoid u;\n")
  assertRuleSkipsSource(t, "unicorn/relative-url-style", "declare const base: string; const u = new URL(\"foo\", base);\n")
}
