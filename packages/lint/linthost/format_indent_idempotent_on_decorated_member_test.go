package linthost

import "testing"

// TestFormatIndentIdempotentOnDecoratedMember verifies an already-correct
// decorated member is a fixed point.
//
// The decorated-member declaration-line pass must not fight a canonical
// layout: when the decorator line and the declaration line both already sit
// at member depth, the rule must emit nothing. This literal no-finding
// oracle protects both lines without asserting a formatter cascade's
// pass sequence or convergence.
//
//  1. Parse a class whose decorator and declaration lines are both at two
//     spaces.
//  2. Run the rule.
//  3. Assert it emits no finding.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must return no findings when both the decorator and its separate declaration line already have two spaces. This catches an unnecessary second declaration edit that could prevent formatter convergence.
// @evidence contracts/testing.md#independent-expectations The supported class-member layout puts both leading decorator and member declaration at the same member column. The literal input already meets that contract independently of member position scanning.
// @evidence contracts/testing.md#distinguishing-cases This canonical single-decorator negative complements NormalizesDecoratedMemberDeclarationLine, where both lines are flush left, and NormalizesMultipleDecoratorLines, which owns the final-decorator boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentIdempotentOnDecoratedMember owns its canonical fixture in the public Go unit population. The syntax-only harness calls the owning rule in process without consumer installation, native artifact production or starting a product host.
func TestFormatIndentIdempotentOnDecoratedMember(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/indent",
    "class User {\n  @Column()\n  name: string = \"\";\n}\n",
  )
}
