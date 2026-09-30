package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessCollectionArgument verifies
// unicorn/no-useless-collection-argument reports an empty array literal
// passed to `new Set(...)`.
//
// The rule matches by constructor identifier and one of four useless-argument
// shapes; `new Set([])` covers the empty-array-literal branch, which is the
// shape most often introduced by templating helpers, so locking it down here
// also guards the identifier-callee lookup that the other branches share.
//
// 1. Enable unicorn/no-useless-collection-argument via an expect annotation.
// 2. Construct a `Set` with an explicit empty array literal.
// 3. Assert the new expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies Set receives an empty literal collection; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-collection-argument annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Set omits the empty default collection argument. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessCollectionArgument is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessCollectionArgument(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-collection-argument.ts", "// expect: unicorn/no-useless-collection-argument error\nconst s = new Set([]);\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-collection-argument", "const s = new Set();\n")
}
