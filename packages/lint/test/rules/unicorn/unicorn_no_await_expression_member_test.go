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
func TestRuleCorpusUnicornNoAwaitExpressionMember(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-await-expression-member.ts", "async function f() {\n  // expect: unicorn/no-await-expression-member error\n  return (await Promise.resolve({ a: 1 })).a;\n}\nJSON.stringify(f);\n")
}
