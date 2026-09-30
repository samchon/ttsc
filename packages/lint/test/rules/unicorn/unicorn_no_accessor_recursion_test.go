package linthost

import "testing"

// TestRuleCorpusUnicornNoAccessorRecursion verifies the rule reports
// `this.value` reads inside a `get value()` accessor.
//
// The accessor name is captured from the declaration and matched against
// every `this.<X>` read inside the body — the recursive call would hit
// the same getter and overflow the stack. This fixture pins the getter
// arm of the rule.
//
// 1. Enable unicorn/no-accessor-recursion via an expect annotation.
// 2. Define `get value()` that returns `this.value`.
// 3. Assert the recursive property access is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a getter reads its own this.value accessor; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-accessor-recursion annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the getter reads a distinct backing field. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoAccessorRecursion is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoAccessorRecursion(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-accessor-recursion.ts", "class C {\n  get value() {\n    // expect: unicorn/no-accessor-recursion error\n    return this.value;\n  }\n}\nvoid C;\n")
  assertRuleSkipsSource(t, "unicorn/no-accessor-recursion", "class C { private backing = 1; get value() { return this.backing; } }\n")
}
