package linthost

import "testing"

// TestFormatDeclarationHeaderIdempotentOnExplodedClassBody verifies the rule
// reproduces its most complex output shape byte-for-byte so the cascade
// converges: tier-two one-type-per-line plus a class brace on its own line.
//
//  1. Parse a class header already in the exploded + own-line-brace shape.
//  2. Run format/declaration-header at printWidth 80.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must emit no finding for a canonical one-type-per-line implements class with a standalone opening brace.
// @evidence contracts/testing.md#independent-expectations The independent canonical source literal specifies the four-interface second-tier layout and intact x=1 body without computing an expectation through the rule.
// @evidence contracts/testing.md#distinguishing-cases This unchanged complex layout complements its actual flat-to-exploded positive and the first-tier inline-types case; no output-read comparison is claimed here.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderIdempotentOnExplodedClassBody is selected by TestSelectedLintUnits as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and observes zero findings without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderIdempotentOnExplodedClassBody(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "class Booooooooooooooo\n  implements\n    Firstttttttttttttttt,\n    Secondddddddddddddddd,\n    Thirddddddddddddddddd,\n    Fourthhhhhhhhhhhhhhh\n{\n  x = 1;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
