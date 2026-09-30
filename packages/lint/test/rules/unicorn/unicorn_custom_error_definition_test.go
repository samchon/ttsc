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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase verifies the missing-super class diagnostic and assertRuleSkipsSource accepts the same subclass with super(), exposing missed constructor validation or false positives.
// @evidence contracts/testing.md#independent-expectations JavaScript derived-constructor initialization and the supported Error subclass policy establish the authored missing/present super-call distinction.
// @evidence contracts/testing.md#distinguishing-cases The original constructor without super remains reported; adding super to the constructor is the adjacent accepted control.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornCustomErrorDefinition owns this authored source matrix as one discoverable Go unit entry. Its authored positive and negative ASTs execute the owning engine in the shared Go process; corpus/zero-finding failures retain fixture source identity. No installed consumer, native build or child product host runs.
func TestRuleCorpusUnicornCustomErrorDefinition(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/custom-error-definition.ts", "// expect: unicorn/custom-error-definition error\nclass MyError extends Error {\n  constructor() {\n    void 0;\n  }\n}\nvoid MyError;\n")
  assertRuleSkipsSource(t, "unicorn/custom-error-definition", "class MyError extends Error { constructor() { super(); } }\nvoid MyError;\n")
}
