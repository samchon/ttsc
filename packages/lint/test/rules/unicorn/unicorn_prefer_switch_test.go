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
func TestRuleCorpusUnicornPreferSwitch(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-switch.ts", "declare const k: string;\n// expect: unicorn/prefer-switch error\nif (k === \"a\") {\n  void 0;\n} else if (k === \"b\") {\n  void 0;\n} else if (k === \"c\") {\n  void 0;\n}\n")
}
