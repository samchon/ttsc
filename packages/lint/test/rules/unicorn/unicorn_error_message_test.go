package linthost

import "testing"

// TestRuleCorpusUnicornErrorMessage verifies unicorn/error-message reports
// `new Error()` constructed without a message argument.
//
// The rule matches each built-in Error constructor — Error, TypeError,
// RangeError, SyntaxError, ReferenceError, EvalError, URIError,
// AggregateError — when called with zero arguments or with a single empty
// string literal. This fixture pins the zero-argument branch which is the
// most common source of message-less throw sites.
//
// 1. Enable unicorn/error-message via an expect annotation.
// 2. Throw `new Error()` with no arguments.
// 3. Assert the new-expression is reported.
func TestRuleCorpusUnicornErrorMessage(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/error-message.ts", "// expect: unicorn/error-message error\nthrow new Error();\n")
}
