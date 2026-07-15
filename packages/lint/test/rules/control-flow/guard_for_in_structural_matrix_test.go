package linthost

import "testing"

// TestGuardForInStructuralMatrix pins guard-for-in to ESLint's purely
// STRUCTURAL contract: the rule inspects the SHAPE of the loop body and
// never what the guard `if` tests. The previous port demanded a
// semantic `Object.hasOwn`/`hasOwnProperty.call` guard, producing four
// false-positive classes (issue #597) and one false negative.
//
// Expectations are the upstream oracle (`eslint/lib/rules/guard-for-in.js`):
// the body is valid when it is an empty statement, any `if` statement, an
// empty block, a block whose sole statement is any `if`, or a block whose
// leading `if` has a `continue` consequent; anything else is reported once
// on the loop.
//
// 1. Wrap each body in a single `for (const k in o)` loop.
// 2. Run the native Engine with guard-for-in at error.
// 3. Assert the exact finding count matches the upstream verdict.
func TestGuardForInStructuralMatrix(t *testing.T) {
  cases := []struct {
    name string
    body string
    want int
  }{
    // The six-row matrix from issue #597. Rows 1-4 were false positives
    // under the semantic port; row 5 was a false negative.
    {"block_hasOwnProperty_method_guard", "{ if (o.hasOwnProperty(k)) { use(k); } }", 0},
    {"bare_if_statement_body", "if (cond) use(k);", 0},
    {"leading_if_prefix_continue_then_more", "{ if (k.startsWith(\"_\")) continue; use(k); }", 0},
    {"block_sole_if_arbitrary_condition", "{ if (cond) { use(k); } }", 0},
    {"leading_if_guard_with_trailing_statement", "{ if (Object.hasOwn(o, k)) { use(k); } after(); }", 1},
    {"unguarded_single_statement", "{ use(k); }", 1},

    // Boundary shapes covering the five structural early-returns, the
    // block/bare `continue` consequent forms, and their negative twins.
    {"empty_statement_body", ";", 0},
    {"empty_block_body", "{ }", 0},
    {"bare_expression_statement_body", "use(k);", 1},
    {"leading_if_bare_continue_consequent", "{ if (cond) continue; use(k); }", 0},
    {"leading_if_block_continue_consequent", "{ if (cond) { continue; } use(k); }", 0},
    {"leading_if_block_without_continue_and_trailing", "{ if (cond) { skip(); } use(k); }", 1},
    {"leading_if_expr_consequent_and_trailing", "{ if (cond) skip(); use(k); }", 1},
    {"leading_if_multi_statement_continue_block", "{ if (cond) { log(); continue; } use(k); }", 1},
    {"leading_non_if_before_guard", "{ use(k); if (cond) continue; }", 1},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      source := "function scenario(o: Record<string, unknown>): void {\n" +
        "  for (const k in o) " + tc.body + "\n" +
        "}\n"
      _, _, findings := runRuleFindingsSnapshot(t, "guard-for-in", source, nil)
      if len(findings) != tc.want {
        t.Fatalf(
          "guard-for-in on body %q: want %d finding(s), got %d (%+v)",
          tc.body,
          tc.want,
          len(findings),
          findings,
        )
      }
    })
  }
}
