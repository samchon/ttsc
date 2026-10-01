package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine compares exactly the ambient declarator under declare true and the local declarator under declare false.
// @evidence contracts/testing.md#independent-expectations The enclosing declare variable statement independently marks its declarator ambient; the local initialized statement has no declare modifier.
// @evidence contracts/testing.md#distinguishing-cases Ambient/local sources are opposite boolean-attribute counterparts with full original declarator ranges.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxInheritsDeclareFromVariableStatements is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxInheritsDeclareFromVariableStatements(t *testing.T) {
  source := `declare const ambient: number;
const local = 1;
void local;
`
  declaredSelector := `VariableDeclarator[declare=true]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+declaredSelector+`"`),
    noRestrictedSyntaxExpectation{target: "ambient: number", message: noRestrictedDefaultMessage(declaredSelector)},
  )

  localSelector := `VariableDeclarator[declare=false]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+localSelector+`"`),
    noRestrictedSyntaxExpectation{target: "local = 1", message: noRestrictedDefaultMessage(localSelector)},
  )
}
