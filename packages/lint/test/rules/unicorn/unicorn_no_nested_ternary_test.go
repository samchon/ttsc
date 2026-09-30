package linthost

import "testing"

// TestRuleCorpusUnicornNoNestedTernary verifies unicorn/no-nested-ternary
// reports a ternary nested inside another ternary's else branch.
//
// The unicorn variant differs from core `no-nested-ternary`: it reports on
// the INNER conditional (so each nested level surfaces its own diagnostic)
// rather than only the outermost. The fixture pins that contract by placing
// the expect annotation immediately above the outer ternary; `stripParens`
// in `hasUnicornNestedConditional` makes the match parens-insensitive.
//
// 1. Enable unicorn/no-nested-ternary via an expect annotation.
// 2. Chain two ternaries through the else branch.
// 3. Assert the inner conditional is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a ternary arm contains another ternary expression; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-nested-ternary annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a single ternary keeps both arms unnested. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoNestedTernary is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoNestedTernary(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-nested-ternary.ts", "declare const x: number;\n// expect: unicorn/no-nested-ternary error\nconst r = x === 0 ? \"zero\" : x > 0 ? \"pos\" : \"neg\";\nJSON.stringify(r);\n")
  assertRuleSkipsSource(t, "unicorn/no-nested-ternary", "declare const x: number; const r = x === 0 ? \"zero\" : \"nonzero\";\n")
}
