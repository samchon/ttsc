package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessPromiseResolveReject verifies
// unicorn/no-useless-promise-resolve-reject reports `return Promise.resolve(...)`
// inside an `async` function.
//
// The rule combines a parent walk for the async context with a property-access
// match for `Promise.resolve` / `Promise.reject`; this fixture is the minimal
// positive case, so a regression in either the modifier check or the callee
// shape surfaces immediately.
//
// 1. Enable unicorn/no-useless-promise-resolve-reject via an expect annotation.
// 2. Return `Promise.resolve(1)` from an `async` function.
// 3. Assert the return statement is reported.
func TestRuleCorpusUnicornNoUselessPromiseResolveReject(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-promise-resolve-reject.ts", "async function f() {\n  // expect: unicorn/no-useless-promise-resolve-reject error\n  return Promise.resolve(1);\n}\nvoid f;\n")
}
