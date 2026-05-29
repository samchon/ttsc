package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessUndefined verifies unicorn/no-useless-undefined
// reports `return undefined;`.
//
// The minimum-viable port fires only on the return-statement shape; the call
// argument and parameter-default cases are deferred, so this fixture pins the
// one branch the rule implements and guards against regressions in the
// `undefined` identifier / keyword normalization.
//
// 1. Enable unicorn/no-useless-undefined via an expect annotation.
// 2. Declare a function that does `return undefined;`.
// 3. Assert the return statement is reported.
func TestRuleCorpusUnicornNoUselessUndefined(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-undefined.ts", "function f() {\n  // expect: unicorn/no-useless-undefined error\n  return undefined;\n}\nvoid f;\n")
}
