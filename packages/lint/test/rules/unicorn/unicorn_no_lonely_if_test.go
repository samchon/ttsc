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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an else block contains only a nested if; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-lonely-if annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; else-if expresses the same branch without an extra block. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoLonelyIf is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoLonelyIf(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-lonely-if.ts", "if (1 === 1) {\n  void 0;\n} else {\n  // expect: unicorn/no-lonely-if error\n  if (2 === 2) {\n    void 0;\n  }\n}\n")
  assertRuleSkipsSource(t, "unicorn/no-lonely-if", "if (1 === 1) { void 0; } else if (2 === 2) { void 0; }\n")
}
