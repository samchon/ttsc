package linthost

import "testing"

// TestRuleCorpusUnicornThrowNewError verifies unicorn/throw-new-error reports
// `throw Error(...)` without `new`.
//
// The rule fires only when the throw operand is a CallExpression with an
// identifier callee matching the built-in Error name list (Error, TypeError,
// RangeError, SyntaxError, ReferenceError, EvalError, URIError,
// AggregateError). This fixture exercises the most common `throw Error("msg")`
// shape and pins the call-vs-new discrimination at the rule's core.
//
// 1. Enable unicorn/throw-new-error via an expect annotation.
// 2. Throw `Error("oops")` without `new`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornThrowNewError(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/throw-new-error.ts", "// expect: unicorn/throw-new-error error\nthrow Error(\"oops\");\n")
}
