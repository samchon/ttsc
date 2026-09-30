package linthost

import "testing"

// TestRuleCorpusUnicornNoImmediateMutation verifies the rule reports a
// mutating array method called directly on an array literal.
//
// The receiver-shape check fires for ArrayLiteralExpression receivers
// because `[1, 2, 3].push(4)` discards the constructed array and exposes
// only the mutator's return value (the new length). This fixture pins the
// literal-receiver arm of the rule.
//
// 1. Enable unicorn/no-immediate-mutation via an expect annotation.
// 2. Call `.push(4)` on `[1, 2, 3]` directly.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies push immediately mutates a newly created array expression; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-immediate-mutation annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; push targets an existing named array rather than a fresh expression. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoImmediateMutation is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoImmediateMutation(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-immediate-mutation.ts", "// expect: unicorn/no-immediate-mutation error\nconst last = [1, 2, 3].push(4);\nvoid last;\n")
  assertRuleSkipsSource(t, "unicorn/no-immediate-mutation", "const values = [1,2,3]; values.push(4);\n")
}
