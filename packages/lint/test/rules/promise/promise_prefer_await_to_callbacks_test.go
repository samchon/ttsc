package linthost

import "testing"

// TestRuleCorpusPromisePreferAwaitToCallbacks verifies
// promise/prefer-await-to-callbacks reports callback-shaped function APIs.
//
// This pins the parameter-name branch, separate from direct callback calls.
//
// 1. Enable promise/prefer-await-to-callbacks.
// 2. Declare a function whose last parameter is callback.
// 3. Assert the callback parameter is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original trailing callback parameter while allowing a non-callback parameter name.
// @evidence contracts/testing.md#independent-expectations The callback API policy identifies a final callback or cb parameter; the authored annotation isolates that convention rather than function body content.
// @evidence contracts/testing.md#distinguishing-cases The original callback parameter reports; a value-taking function and a parameterless function remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromisePreferAwaitToCallbacks owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromisePreferAwaitToCallbacks(t *testing.T) {
  assertRuleCorpusCase(t, "promise/prefer-await-to-callbacks.ts", "// expect: promise/prefer-await-to-callbacks error\nfunction load(callback: () => void) {\n  void callback;\n}\n")
  assertRuleSkipsSource(t, "promise/prefer-await-to-callbacks", "function load(value: number) { void value; } function empty() {}\n")
}
