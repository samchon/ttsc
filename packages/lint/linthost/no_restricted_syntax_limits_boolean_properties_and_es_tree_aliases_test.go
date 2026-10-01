package linthost

import (
  "encoding/json"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Engine keeps absent Identifier async false clean and reports only the original unary expression and object-method Property alias.
// @evidence contracts/testing.md#independent-expectations Missing boolean attributes are not false; ESTree UnaryExpression excludes update syntax and Property denotes object rather than class methods. These authored differences define the oracle.
// @evidence contracts/testing.md#distinguishing-cases Absent async stays unmatched; void but not ++ matches unary, and object method but not class method matches Property.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxLimitsBooleanPropertiesAndESTreeAliases is selected in the shared Go unit population. It calls runNoRestrictedSyntax through the owning Engine, retaining every original source/selector/options/target/message and the entry ownership of its in-source variants. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxLimitsBooleanPropertiesAndESTreeAliases(t *testing.T) {
  source := `let count = 0;
++count;
void count;
class Box { classMethod(): number { return 1; } }
const record = { objectMethod(): number { return 2; } };
JSON.stringify([Box, record]);
`
  runNoRestrictedSyntax(t, source, json.RawMessage(`"Identifier[async=false]"`))

  unarySelector := `UnaryExpression`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+unarySelector+`"`),
    noRestrictedSyntaxExpectation{target: "void count", message: noRestrictedDefaultMessage(unarySelector)},
  )

  propertySelector := `Property`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+propertySelector+`"`),
    noRestrictedSyntaxExpectation{
      target:  "objectMethod(): number { return 2; }",
      message: noRestrictedDefaultMessage(propertySelector),
    },
  )
}
