package linthost

import (
  "encoding/json"
  "sort"
  "testing"
)

// TestNoMixedOperatorsReportsBothOperatorTokens verifies each mixed pair reports
// both operator tokens rather than one whole nested expression.
//
// ESLint's reportBothOperators uses the binary token or the conditional question
// token. Every adjacent mixed pair owns two reports, including a shared token
// participating in two different pairs.
//
//  1. Run authored left/right, conditional, trivia and nested-pair inputs.
//  2. Compare every diagnostic with literal half-open operator byte ranges.
//  3. Require parentheses and default coalesce groups to remain silent.
//
// @evidence contracts/testing.md#behavioral-verification The actual no-mixed-operators rule must report two precise token ranges per logical, arithmetic or configured conditional pair, and four reports for two adjacent pairs; explicit grouping and default ungrouped coalesce stay silent.
// @evidence contracts/testing.md#independent-expectations ESLint's reportBothOperators defines the two-token reporting contract. Literal byte ranges are authored from each source independently of the emitted findings or compiler nodes.
// @evidence contracts/testing.md#distinguishing-cases Left and right binary children, same-precedence opt-out, all three conditional operands, comment trivia, overlapping pairs and configured/default coalesce distinguish token selection and exemption decisions.
// @evidence contracts/testing.md#execution-ownership This selected Go entry and its named subtests call the existing rule snapshot harness directly in one Go process; no installed consumer, executable config or native host is prepared.
func TestNoMixedOperatorsReportsBothOperatorTokens(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    options json.RawMessage
    ranges  [][2]int
  }{
    {"left logical", "const x = a && b || c;\n", nil, [][2]int{{12, 14}, {17, 19}}},
    {"right logical", "const x = a || b && c;\n", nil, [][2]int{{12, 14}, {17, 19}}},
    {"arithmetic", "const x = a + b * c;\n", nil, [][2]int{{12, 13}, {16, 17}}},
    {"same precedence opt-out", "const x = a + b - c;\n", json.RawMessage(`{"allowSamePrecedence":false}`), [][2]int{{12, 13}, {16, 17}}},
    {"conditional condition", "const x = a && b ? c : d;\n", json.RawMessage(`{"groups":[["&&","?:"]]}`), [][2]int{{12, 14}, {17, 18}}},
    {"conditional consequent", "const x = a ? b && c : d;\n", json.RawMessage(`{"groups":[["&&","?:"]]}`), [][2]int{{12, 13}, {16, 18}}},
    {"conditional alternate", "const x = a ? b : c && d;\n", json.RawMessage(`{"groups":[["&&","?:"]]}`), [][2]int{{12, 13}, {20, 22}}},
    {"operator trivia", "const x = a /*x*/ + b /*y*/ * c;\n", nil, [][2]int{{18, 19}, {28, 29}}},
    {"overlapping pairs", "const x = a + b * c ** d;\n", nil, [][2]int{{12, 13}, {16, 17}, {16, 17}, {20, 22}}},
    {"configured coalesce", "const x = a ?? b + c;\n", json.RawMessage(`{"groups":[["??","+"]]}`), [][2]int{{12, 14}, {17, 18}}},
    {"default coalesce", "const x = a ?? b + c;\n", nil, nil},
    {"parenthesized pair", "const x = a + (b * c);\n", nil, nil},
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "no-mixed-operators", testCase.source, testCase.options)
      sort.SliceStable(findings, func(left, right int) bool {
        return findings[left].Pos < findings[right].Pos
      })
      if len(findings) != len(testCase.ranges) {
        t.Fatalf("want %d operator reports, got %d: %+v", len(testCase.ranges), len(findings), findings)
      }
      for index, expected := range testCase.ranges {
        if got := findings[index]; got.Pos != expected[0] || got.End != expected[1] {
          t.Errorf("operator report %d: want [%d,%d), got [%d,%d)", index, expected[0], expected[1], got.Pos, got.End)
        }
      }
    })
  }
}
