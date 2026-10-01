package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessErrorCaptureStackTrace verifies the rule
// reports `Error.captureStackTrace(this, MyError)` inside an Error subclass.
//
// The canonical constructor filter names the surrounding class. An arbitrary
// external constructor filter can remove other frames and is retained by the
// known-boundary regression; this fixture preserves the original policy input.
//
// 1. Enable unicorn/no-useless-error-capture-stack-trace via an expect annotation.
// 2. Call `Error.captureStackTrace(this, MyError)` inside an Error subclass.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies the supported explicit-capture policy for an Error subclass after super; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-error-capture-stack-trace annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the subclass relies on super to establish its stack. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessErrorCaptureStackTrace is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessErrorCaptureStackTrace(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-error-capture-stack-trace.ts", "class MyError extends Error {\n  constructor(msg: string) {\n    super(msg);\n    // expect: unicorn/no-useless-error-capture-stack-trace error\n    Error.captureStackTrace(this, MyError);\n  }\n}\nvoid new MyError(\"x\");\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-error-capture-stack-trace", "class MyError extends Error { constructor(msg: string) { super(msg); } }\n")
}
