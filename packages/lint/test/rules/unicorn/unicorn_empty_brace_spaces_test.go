package linthost

import "testing"

// TestRuleCorpusUnicornEmptyBraceSpaces verifies unicorn/empty-brace-spaces
// reports an empty object literal containing whitespace between its braces.
//
// The rule visits both Block and ObjectLiteralExpression and fires when the
// node is empty and the source-text region between the open and close braces
// contains at least one whitespace byte. This fixture exercises the object
// literal arm with a single space between the braces.
//
// 1. Enable unicorn/empty-brace-spaces via an expect annotation.
// 2. Declare an object literal with whitespace between its braces.
// 3. Assert the object literal expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an otherwise empty object contains interior whitespace; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/empty-brace-spaces annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the identical empty object has no interior whitespace. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornEmptyBraceSpaces is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornEmptyBraceSpaces(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/empty-brace-spaces.ts", "// expect: unicorn/empty-brace-spaces error\nconst o = { };\n")
  assertRuleSkipsSource(t, "unicorn/empty-brace-spaces", "const o = {};\n")
}
