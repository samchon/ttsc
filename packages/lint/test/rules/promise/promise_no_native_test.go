package linthost

import "testing"

// TestRuleCorpusPromiseNoNative verifies promise/no-native reports implicit
// global Promise use.
//
// This preserves eslint-plugin-promise's ES5 environment policy without
// requiring the TypeScript checker or scope graph.
//
// 1. Enable promise/no-native.
// 2. Use Promise.resolve without declaring Promise locally.
// 3. Assert the global Promise use is reported once.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports one global Promise use under the ES5 environment policy and honors an explicit local Promise declaration.
// @evidence contracts/testing.md#independent-expectations The original authored annotation marks the implicit global; the policy allows a declared replacement without requiring native global availability.
// @evidence contracts/testing.md#distinguishing-cases Global Promise.resolve reports; the fixture that declares its own Promise stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseNoNative owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseNoNative(t *testing.T) {
  assertRuleCorpusCase(t, "promise/no-native.ts", "// expect: promise/no-native error\nPromise.resolve(1);\n")
  assertRuleSkipsSource(t, "promise/no-native", "declare const Promise: { resolve(value: number): unknown }; Promise.resolve(1);\n")
}
