package linthost

import "testing"

// TestRuleCorpusUnicornNoNull verifies unicorn/no-null reports a bare `null` literal.
//
// Every `null` literal flows through `KindNullKeyword`; visiting the kind once
// and reporting unconditionally is the rule's only behavior, so this fixture
// is both the minimal positive case and a guard that the engine still
// dispatches to bare-keyword visitors.
//
// 1. Enable unicorn/no-null via an expect annotation.
// 2. Declare a const initialized to the bare `null` literal.
// 3. Assert the literal is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a null literal represents absence under the undefined policy; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-null annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; undefined represents absence without a null literal. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoNull is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoNull(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-null.ts", "// expect: unicorn/no-null error\nconst x = null;\n")
  assertRuleSkipsSource(t, "unicorn/no-null", "const x = undefined;\n")
}
