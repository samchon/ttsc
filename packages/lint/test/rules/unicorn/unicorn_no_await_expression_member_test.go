package linthost

import "testing"

// TestRuleCorpusUnicornNoAwaitExpressionMember verifies
// unicorn/no-await-expression-member reports member access on an
// `await` expression.
//
// The canonical violation is `(await x).y`, which parses as a
// `PropertyAccessExpression` whose receiver is a
// `ParenthesizedExpression(AwaitExpression)`. `stripParens` collapses the
// parens before the receiver-kind check, so the rule matches both this
// shape and a bare `AwaitExpression` receiver in one branch.
//
// 1. Enable unicorn/no-await-expression-member via an expect annotation.
// 2. Inside an async function, project a property off `(await ...)`.
// 3. Assert the property access is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies member access is directly attached to an await expression; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-await-expression-member annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; await first binds the object and then reads its member. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoAwaitExpressionMember is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoAwaitExpressionMember(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-await-expression-member.ts", "async function f() {\n  // expect: unicorn/no-await-expression-member error\n  return (await Promise.resolve({ a: 1 })).a;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "unicorn/no-await-expression-member", "async function f() { const result = await Promise.resolve({ a: 1 }); return result.a; }\n")
}
