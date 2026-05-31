package linthost

import "testing"

// TestFormatClauseJoinSkipsEmptyStatementBody verifies clause-join abstains on
// an empty-statement control-flow body written on its own line. Prettier's
// adjustClause special-cases EmptyStatement and glues the `;` to the header with
// NO space (`while (x);`); this rule's gap->" " rewrite would instead emit
// `while (x) ;`, so it must report nothing and leave the source shape.
func TestFormatClauseJoinSkipsEmptyStatementBody(t *testing.T) {
  t.Run("while", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/clause-join",
      "while (x)\n  ;\n",
      `{"printWidth":80,"tabWidth":2}`,
    )
  })
  t.Run("for", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(
      t,
      "format/clause-join",
      "for (let i = 0; i < n; i++)\n  ;\n",
      `{"printWidth":80,"tabWidth":2}`,
    )
  })
}
