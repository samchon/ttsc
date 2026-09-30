package linthost

import "testing"

// TestRuleCorpusUnicornNoKeywordPrefix verifies unicorn/no-keyword-prefix
// reports a `let`/`const`-declared identifier that starts with `new` or
// `class` followed by an uppercase letter.
//
// The rule visits every `Identifier` but fires only on declaration name
// slots — the diagnostic should anchor on the introduction of the binding,
// not on every read. This fixture pins the variable-declaration arm.
//
// 1. Enable unicorn/no-keyword-prefix via an expect annotation.
// 2. Declare `const newFoo = 1` and read it once.
// 3. Assert the declaration name is reported (and the read is not).
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies the identifier newFoo uses the forbidden keyword prefix; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-keyword-prefix annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the identifier foo denotes the same declaration without the prefix. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoKeywordPrefix is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoKeywordPrefix(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-keyword-prefix.ts", "// expect: unicorn/no-keyword-prefix error\nconst newFoo = 1;\nvoid newFoo;\n")
  assertRuleSkipsSource(t, "unicorn/no-keyword-prefix", "const foo = 1; void foo;\n")
}
