package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessSwitchCase verifies
// unicorn/no-useless-switch-case reports an empty `case` clause that
// sits immediately above the `default` clause — the value would have
// hit `default` anyway.
//
// The rule visits each `SwitchStatement`, walks the case block, and
// reports any non-default `CaseClause` whose statements list is empty
// and whose immediate next sibling is the `DefaultClause`. The fixture
// pins `case 2:` to fall through into `default:` with no body.
//
// 1. Enable unicorn/no-useless-switch-case via an expect annotation.
// 2. Place an empty `case 2:` directly before `default:`.
// 3. Assert the empty case clause is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an empty case falls directly through to the default arm; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-switch-case annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; nonempty case 2 with its explicit break distinguishes the original empty fallthrough, and the separate populated-case control remains accepted. All three source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessSwitchCase is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessSwitchCase(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-switch-case.ts", "declare const x: number;\nswitch (x) {\n  case 1:\n    void 0;\n    break;\n  // expect: unicorn/no-useless-switch-case error\n  case 2:\n  default:\n    void 0;\n}\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-switch-case", "declare const x: number; switch(x) { case 1: void 1; break; default: void 0; }\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-switch-case", "declare const x: number; switch(x) { case 1: void 0; break; case 2: void 2; break; default: void 0; }\n")
}
