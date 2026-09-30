package linthost

import "testing"

// TestRuleCorpusUnicornNoSinglePromiseInPromiseMethods verifies
// unicorn/no-single-promise-in-promise-methods reports a `Promise.all`
// call whose only argument is a one-element array literal.
//
// The match is on the `Promise.<method>` callee plus the single-element
// array-literal argument. The receiver is identifier-text-only, so this
// fixture covers the canonical positive case across the four collection
// methods (`all`/`allSettled`/`race`/`any`).
//
//  1. Enable unicorn/no-single-promise-in-promise-methods via an expect
//     annotation.
//  2. Call `Promise.all([Promise.resolve(1)])` at the top level.
//  3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies Promise.all wraps a singleton promise array; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-single-promise-in-promise-methods annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Promise.all receives two promises rather than the singleton boundary. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoSinglePromiseInPromiseMethods is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoSinglePromiseInPromiseMethods(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-single-promise-in-promise-methods.ts", "// expect: unicorn/no-single-promise-in-promise-methods error\nconst p = Promise.all([Promise.resolve(1)]);\n")
  assertRuleSkipsSource(t, "unicorn/no-single-promise-in-promise-methods", "const p = Promise.all([Promise.resolve(1), Promise.resolve(2)]);\n")
}
