package linthost

import "testing"

// TestRuleCorpusUnicornPreferSwitch verifies unicorn/prefer-switch
// reports an if/else-if ladder of three or more branches that compare
// the same discriminant against literal labels.
//
// The MVP fires only on the outermost if of a chain of at least three
// branches whose conditions are `discriminant === <string-or-number>`.
// This fixture pins that branch shape so the discriminant-text equality
// check and the chain-length threshold stay covered.
//
//  1. Enable unicorn/prefer-switch via an expect annotation.
//  2. Build a three-branch if/else-if ladder comparing `k` against `"a"`,
//     `"b"`, and `"c"`.
//  3. Assert the outermost if is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies three equality branches inspect the same discriminator; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-switch annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a switch owns the same three discriminator values, while a two-branch equality ladder is below the reporting threshold. All three source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferSwitch is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferSwitch(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-switch.ts", "declare const k: string;\n// expect: unicorn/prefer-switch error\nif (k === \"a\") {\n  void 0;\n} else if (k === \"b\") {\n  void 0;\n} else if (k === \"c\") {\n  void 0;\n}\n")
  assertRuleSkipsSource(t, "unicorn/prefer-switch", "declare const k: string; switch(k) { case \"a\": void 0; break; case \"b\": void 0; break; case \"c\": void 0; break; }\n")
  assertRuleSkipsSource(t, "unicorn/prefer-switch", "declare const k: string; if (k === \"a\") { void 0; } else if (k === \"b\") { void 0; }\n")
}
