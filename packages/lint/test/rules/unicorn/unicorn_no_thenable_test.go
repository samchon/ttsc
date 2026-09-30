package linthost

import "testing"

// TestRuleCorpusUnicornNoThenable verifies unicorn/no-thenable reports an
// object-literal method named `then`.
//
// A method named `then` is the most common way to accidentally make a plain
// object thenable. The rule dispatches on every property-defining node form
// and only checks the property's name; the fixture uses a method declaration
// to pin the dispatch path while keeping the minimal positive case readable.
//
// 1. Enable unicorn/no-thenable via an expect annotation.
// 2. Define an object literal with a method named `then`.
// 3. Assert the method declaration is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an object declares a then method and becomes accidentally thenable; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-thenable annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a differently named method retains the callable property without then. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoThenable is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoThenable(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-thenable.ts", "const o = {\n  // expect: unicorn/no-thenable error\n  then() {\n    return 1;\n  },\n};\nvoid o;\n")
  assertRuleSkipsSource(t, "unicorn/no-thenable", "const o = { read() { return 1; } };\n")
}
