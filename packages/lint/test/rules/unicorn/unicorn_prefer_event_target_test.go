package linthost

import "testing"

// TestRuleCorpusUnicornPreferEventTarget verifies the rule reports a
// `new EventEmitter()` constructor call.
//
// The rule matches purely on the bare identifier callee of a
// NewExpression; receivers are not type-checked. A locally declared
// `EventEmitter` class stand-in is the smallest fixture that exercises
// the only branch the rule has and matches the legacy Node-style
// emitter the rule exists to replace with `EventTarget`.
//
// 1. Enable unicorn/prefer-event-target via an expect annotation.
// 2. Construct `new EventEmitter()` on a declared `EventEmitter` class.
// 3. Assert the new-expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an EventEmitter constructor is selected instead of the web event target; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-event-target annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; EventTarget supplies the accepted event target constructor. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferEventTarget is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferEventTarget(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-event-target.ts", "declare class EventEmitter { constructor(); }\n// expect: unicorn/prefer-event-target error\nconst em = new EventEmitter();\nvoid em;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-event-target", "const em = new EventTarget();\n")
}
