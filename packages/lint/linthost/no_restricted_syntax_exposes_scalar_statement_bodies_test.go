package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxExposesScalarStatementBodies verifies selectors expose a
// scalar Block body on labeled, catch and static-block parents.
//
// These parents hold their block through body rather than a statement list.
//
//  1. Parse a labeled statement, a catch clause and a class static block.
//  2. Run one body-field selector per parent.
//  3. Assert each selector reports its own block range and no other parent matches.
//
// @evidence contracts/testing.md#behavioral-verification Engine compares all three authored labeled/catch/static-block body ranges under their respective field selectors.
// @evidence contracts/testing.md#independent-expectations Each parent independently exposes a scalar Block through body rather than a statement-list sibling array; literal target blocks supply range oracles.
// @evidence contracts/testing.md#distinguishing-cases Labeled, catch and class-static parents select their own Block bodies, preserving every original selector/target pair and excluding the other parent forms.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxExposesScalarStatementBodies is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxExposesScalarStatementBodies(t *testing.T) {
  source := `label: { void 1; }
try { throw 1; } catch (error) { void error; }
class Box { static { void 2; } }
void Box;
`
  cases := []struct {
    selector string
    target   string
  }{
    {selector: `LabeledStatement > Block.body`, target: `{ void 1; }`},
    {selector: `CatchClause > Block.body`, target: `{ void error; }`},
    {selector: `ClassStaticBlockDeclaration > Block.body`, target: `{ void 2; }`},
  }
  for _, tc := range cases {
    runNoRestrictedSyntax(
      t,
      source,
      json.RawMessage(`"`+tc.selector+`"`),
      noRestrictedSyntaxExpectation{target: tc.target, message: noRestrictedDefaultMessage(tc.selector)},
    )
  }
}
