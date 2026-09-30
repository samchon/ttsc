package linthost

import "testing"

// TestRuleCorpusUnicornSwitchCaseBraces verifies unicorn/switch-case-braces
// reports a `case` clause whose body is multiple bare statements rather
// than a single `{ ... }` block.
//
// The default "always" mode requires every clause body to be a single
// `Block`; two statements in the same clause violates that shape and
// surfaces the rule on the case clause itself.
//
// 1. Enable unicorn/switch-case-braces via an expect annotation.
// 2. Write a `case` clause whose body is `void 0; break;` (no braces).
// 3. Assert the case clause is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a switch case owns unbraced statements; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/switch-case-braces annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same case encloses its statements in braces. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornSwitchCaseBraces is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornSwitchCaseBraces(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/switch-case-braces.ts", "declare const k: string;\nswitch (k) {\n  // expect: unicorn/switch-case-braces error\n  case \"a\":\n    void 0;\n    break;\n}\n")
  assertRuleSkipsSource(t, "unicorn/switch-case-braces", "declare const k: string; switch(k) { case \"a\": { void 0; break; } }\n")
}
