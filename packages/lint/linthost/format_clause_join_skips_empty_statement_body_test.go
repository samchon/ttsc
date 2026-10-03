package linthost

import "testing"

// TestFormatClauseJoinSkipsEmptyStatementBody verifies clause-join abstains on
// an empty-statement control-flow body written on its own line. Prettier's
// adjustClause special-cases EmptyStatement and glues the `;` to the header with
// NO space (`while (x);`); this rule's gap->" " rewrite would instead emit
// `while (x) ;`, so it must report nothing and leave the source shape.
//
//  1. Parse while and for loops with a next-line bare semicolon body.
//  2. Run format/clause-join with printWidth 80 in each named subtest.
//  3. Assert neither input produces a finding.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must return no findings for an empty statement after while or for. The registered cases detect applying its gap-to-space rewrite where the supported empty form has no space before the semicolon.
// @evidence contracts/testing.md#independent-expectations The local rule abstention follows supported empty-statement ownership; Prettier prints while (x); rather than while (x) ;. The oracle asserts no findings rather than deriving a replacement from the implementation.
// @evidence contracts/testing.md#distinguishing-cases The while and for subtests each supply a bare-semicolon negative. JoinsForAndWhileBodies provides the same header kinds with nonempty positive bodies, and SkipsEmptyElseAndDoBodies covers keyword anchors.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinSkipsEmptyStatementBody is the public Go unit host selected by the lint semantic-unit Evidence claim and owns both dynamically registered while and for cases, including their separate failure names and fixtures. The shared syntax-only harness runs the owning rule in process without a consumer install, native artifact build or product host.
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
