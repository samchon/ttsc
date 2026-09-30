package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessErrorCaptureStackTrace verifies the rule
// reports `Error.captureStackTrace(this, MyError)` inside an Error subclass.
//
// The MVP matcher fires on any `Error.captureStackTrace(this, …)` call
// regardless of ancestor — the default Error capture already runs in every
// subclass constructor, so the explicit call is redundant. This fixture pins
// the canonical Error-subclass constructor shape.
//
// 1. Enable unicorn/no-useless-error-capture-stack-trace via an expect annotation.
// 2. Call `Error.captureStackTrace(this, MyError)` inside an Error subclass.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an Error subclass redundantly captures its own stack after super; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-error-capture-stack-trace annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the subclass relies on super to establish its stack. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessErrorCaptureStackTrace is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessErrorCaptureStackTrace(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-error-capture-stack-trace.ts", "class MyError extends Error {\n  constructor(msg: string) {\n    super(msg);\n    // expect: unicorn/no-useless-error-capture-stack-trace error\n    Error.captureStackTrace(this, MyError);\n  }\n}\nvoid new MyError(\"x\");\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-error-capture-stack-trace", "class MyError extends Error { constructor(msg: string) { super(msg); } }\n")
}
