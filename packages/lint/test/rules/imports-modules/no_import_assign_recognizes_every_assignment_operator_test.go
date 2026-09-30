package linthost

import (
  "strings"
  "testing"
)

// TestNoImportAssignRecognizesEveryAssignmentOperator makes the shared
// assignment-operator classifier part of this rule's regression boundary.
//
// @evidence contracts/testing.md#behavioral-verification The checker-backed engine reports writes through all sixteen authored assignment operators with exact ranges and read-only messages.
// @evidence contracts/testing.md#independent-expectations The ECMAScript assignment operator list is literal input; each operator writes the imported binding, so a literal read-only expectation is generated from that independent list, not from findings.
// @evidence contracts/testing.md#distinguishing-cases Includes plain, arithmetic, shifts, bitwise, exponentiation and logical/nullish compound assignment boundaries; shadow/nonwrite controls are owned by TestNoImportAssignIgnoresResolvedShadowsAndDeeperValues.
// @evidence contracts/testing.md#execution-ownership The Test builds source from its independent literal sixteen-operator list, then runNoImportAssignProject loads the Program/checker and calls program.runLintCycle. assertNoImportAssignFindings retains each authored operator snippet as a distinct failure expectation.
func TestNoImportAssignRecognizesEveryAssignmentOperator(t *testing.T) {
  operators := []string{
    "=", "+=", "-=", "*=", "/=", "%=", "**=",
    "<<=", ">>=", ">>>=", "&=", "|=", "^=", "&&=", "||=", "??=",
  }
  var source strings.Builder
  source.WriteString("import { value } from \"./dep\";\n")
  source.WriteString("declare const rhs: any;\n")
  expected := make([]noImportAssignExpectedFinding, 0, len(operators))
  for _, operator := range operators {
    snippet := "value " + operator + " rhs"
    source.WriteString(noImportAssignRangeStart + snippet + noImportAssignRangeEnd + ";\n")
    expected = append(expected, noImportAssignExpectedFinding{
      snippet: snippet,
      message: "'value' is read-only.",
    })
  }

  text := source.String()
  findings := runNoImportAssignProject(t, text)
  assertNoImportAssignFindings(t, text, findings, expected)
}
