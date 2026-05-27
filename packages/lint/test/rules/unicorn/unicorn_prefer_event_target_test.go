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
func TestRuleCorpusUnicornPreferEventTarget(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-event-target.ts", "declare class EventEmitter { constructor(); }\n// expect: unicorn/prefer-event-target error\nconst em = new EventEmitter();\nvoid em;\n")
}
