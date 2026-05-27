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
func TestRuleCorpusUnicornNoUselessErrorCaptureStackTrace(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-useless-error-capture-stack-trace.ts", "class MyError extends Error {\n  constructor(msg: string) {\n    super(msg);\n    // expect: unicorn/no-useless-error-capture-stack-trace error\n    Error.captureStackTrace(this, MyError);\n  }\n}\nvoid new MyError(\"x\");\n")
}
