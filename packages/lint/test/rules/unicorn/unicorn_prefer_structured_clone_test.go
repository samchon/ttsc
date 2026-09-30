package linthost

import "testing"

// TestRuleCorpusUnicornPreferStructuredClone verifies the rule reports
// `JSON.parse(JSON.stringify(x))`.
//
// The nested-call gate is the entire rule: outer `JSON.parse(...)`
// whose single argument is `JSON.stringify(...)`. A plain object
// literal as the inner argument exercises the positive shape without
// pulling in any other surface.
//
// 1. Enable unicorn/prefer-structured-clone via an expect annotation.
// 2. Round-trip an object through `JSON.parse(JSON.stringify(original))`.
// 3. Assert the outer call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies JSON stringify and parse manually clone an object; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-structured-clone annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; structuredClone clones the same object directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferStructuredClone is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferStructuredClone(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-structured-clone.ts", "const original = { a: 1 };\n// expect: unicorn/prefer-structured-clone error\nconst clone = JSON.parse(JSON.stringify(original));\n")
  assertRuleSkipsSource(t, "unicorn/prefer-structured-clone", "const original = { a:1 }; const clone = structuredClone(original);\n")
}
