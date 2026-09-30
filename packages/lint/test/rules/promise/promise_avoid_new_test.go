package linthost

import "testing"

// TestRuleCorpusPromiseAvoidNew verifies promise/avoid-new reports direct
// Promise construction.
//
// Direct constructors are reserved for adapter code in this policy family; the
// rule is intentionally separate from the core Promise executor rules.
//
// 1. Enable promise/avoid-new.
// 2. Construct a Promise directly.
// 3. Assert the constructor expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine distinguishes a direct new Promise constructor from creating a resolved promise through the static API.
// @evidence contracts/testing.md#independent-expectations The explicit policy forbids direct construction; the annotation is authored for new Promise rather than inferred from Engine output.
// @evidence contracts/testing.md#distinguishing-cases Direct construction reports; Promise.resolve and construction of an unrelated class are clean adjacent controls.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseAvoidNew owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseAvoidNew(t *testing.T) {
  assertRuleCorpusCase(t, "promise/avoid-new.ts", "// expect: promise/avoid-new error\nnew Promise((resolve) => resolve(1));\n")
  assertRuleSkipsSource(t, "promise/avoid-new", "Promise.resolve(1); new Adapter();\n")
}
