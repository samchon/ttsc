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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a return explicitly spells the implicit undefined result; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-undefined annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a bare return retains the undefined result. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessUndefined is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessUndefined(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-undefined.ts", "function f() {\n  // expect: unicorn/no-useless-undefined error\n  return undefined;\n}\nvoid f;\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-undefined", "function f() { return; }\n")
}
