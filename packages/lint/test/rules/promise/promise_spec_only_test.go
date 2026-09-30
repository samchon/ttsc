package linthost

import "testing"

// TestRuleCorpusPromiseSpecOnly verifies promise/spec-only reports
// non-standard Promise statics.
//
// The standard static set is intentionally small and mirrors the ECMAScript
// Promise API surface.
//
// 1. Enable promise/spec-only.
// 2. Access a non-standard Promise.delay method.
// 3. Assert the property access is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine rejects the original nonstandard Promise.delay access and allows standard statics and prototype methods.
// @evidence contracts/testing.md#independent-expectations The ECMAScript Promise API supplies the independent allowed names; delay is absent, while resolve and prototype.then are standard.
// @evidence contracts/testing.md#distinguishing-cases The original delay reports; standard resolve and prototype.then accesses stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseSpecOnly owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseSpecOnly(t *testing.T) {
  assertRuleCorpusCase(t, "promise/spec-only.ts", "// expect: promise/spec-only error\nPromise.delay(1);\n")
  assertRuleSkipsSource(t, "promise/spec-only", "Promise.resolve(1); Promise.prototype.then;\n")
}
