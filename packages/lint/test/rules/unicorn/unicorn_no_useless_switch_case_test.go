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
func TestRuleCorpusUnicornNoUselessSwitchCase(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-switch-case.ts", "declare const x: number;\nswitch (x) {\n  case 1:\n    void 0;\n    break;\n  // expect: unicorn/no-useless-switch-case error\n  case 2:\n  default:\n    void 0;\n}\n")
}
