package linthost

import "testing"

// TestRuleCorpusPromiseNoNewStatics verifies promise/no-new-statics reports
// construction of Promise static calls.
//
// Promise statics are functions, not constructors; using `new` changes intent
// and should be caught independently from direct Promise construction.
//
// 1. Enable promise/no-new-statics.
// 2. Construct Promise.resolve.
// 3. Assert the new expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports construction of Promise.resolve while permitting its ordinary call and a direct Promise constructor for this rule.
// @evidence contracts/testing.md#independent-expectations Promise statics are callable APIs, not constructor spellings; the fixed new-expression annotation encodes that distinction.
// @evidence contracts/testing.md#distinguishing-cases new Promise.resolve reports; ordinary resolve and new Promise itself are clean controls for this specific policy.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseNoNewStatics owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseNoNewStatics(t *testing.T) {
  assertRuleCorpusCase(t, "promise/no-new-statics.ts", "// expect: promise/no-new-statics error\nnew Promise.resolve(1);\n")
  assertRuleSkipsSource(t, "promise/no-new-statics", "Promise.resolve(1); new Promise(resolve => resolve(1));\n")
}
