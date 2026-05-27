package linthost

import "testing"

// TestRuleCorpusUnicornCustomErrorDefinition verifies the rule fires
// on a custom Error subclass whose constructor never calls `super`.
//
// The "constructor exists but skips `super`" shape is the canonical
// regression: it leaves the parent `Error`'s message and stack
// plumbing uninitialized. Pinning it exercises both the extends-Error
// heritage check and the super-call walker over the constructor body.
//
// 1. Enable unicorn/custom-error-definition.
// 2. Declare `class MyError extends Error` with an empty constructor.
// 3. Assert the class declaration is reported.
func TestRuleCorpusUnicornCustomErrorDefinition(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/custom-error-definition.ts", "// expect: unicorn/custom-error-definition error\nclass MyError extends Error {\n  constructor() {\n    void 0;\n  }\n}\nvoid MyError;\n")
}
