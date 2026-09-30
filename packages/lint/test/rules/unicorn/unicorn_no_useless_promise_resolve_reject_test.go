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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an async return wraps a value in Promise.resolve; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-promise-resolve-reject annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the async return exposes the same value directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessPromiseResolveReject is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessPromiseResolveReject(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-promise-resolve-reject.ts", "async function f() {\n  // expect: unicorn/no-useless-promise-resolve-reject error\n  return Promise.resolve(1);\n}\nvoid f;\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-promise-resolve-reject", "async function f() { return 1; }\n")
}
