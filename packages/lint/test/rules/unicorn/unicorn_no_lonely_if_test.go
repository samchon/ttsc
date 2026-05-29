package linthost

import "testing"

// TestRuleCorpusUnicornNoLonelyIf verifies unicorn/no-lonely-if reports an
// `if` that is the only statement inside an `else` block.
//
// The parent walk reaches the outer IfStatement only when the immediate
// parent is a Block whose single statement is the visited inner IfStatement
// AND that Block is the outer's ElseStatement. The fixture is the minimal
// triple-nested shape that satisfies all three conditions.
//
// 1. Enable unicorn/no-lonely-if via an expect annotation.
// 2. Nest an `if` as the only statement of an outer `else` block.
// 3. Assert the inner if-statement is reported.
func TestRuleCorpusUnicornNoLonelyIf(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-lonely-if.ts", "if (1 === 1) {\n  void 0;\n} else {\n  // expect: unicorn/no-lonely-if error\n  if (2 === 2) {\n    void 0;\n  }\n}\n")
}
