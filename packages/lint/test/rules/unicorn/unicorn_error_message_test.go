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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies new Error has no diagnostic message; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/error-message annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same Error constructor receives a nonempty diagnostic message. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornErrorMessage is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornErrorMessage(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/error-message.ts", "// expect: unicorn/error-message error\nthrow new Error();\n")
  assertRuleSkipsSource(t, "unicorn/error-message", "throw new Error(\"operation failed\");\n")
}
