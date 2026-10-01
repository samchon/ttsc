package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// TestNoDupeElseIfLogicalCoverage protects both sides of the rule's boolean
// coverage test. Covered branches exercise exact, subset, accumulated, nested,
// and commuted conditions; clean controls include executable near-misses and
// conservative token distinctions, so shared operands alone never cause a report.
//
// @evidence contracts/testing.md#behavioral-verification Eighteen named Engine cases compare every finding line and the exact diagnostic message, exposing missed covered branches and broad false reports.
// @evidence contracts/testing.md#independent-expectations Literal per-case line lists follow earlier-condition coverage and the supported token-structural policy; they are independent of the rule output. Inner expression parentheses remain a conservative token distinction rather than a proof of runtime reachability.
// @evidence contracts/testing.md#distinguishing-cases Exact, subset, accumulated, nested and commuted logical conditions report; broader or partially shared alternatives, separate if chains and identifier/call differences remain clean.
// @evidence contracts/testing.md#execution-ownership TestNoDupeElseIfLogicalCoverage is selected in the shared Go unit population. Its eighteen named subtests call parseTS and Engine.Run directly with only no-dupe-else-if enabled, retaining each source and failure identity. No consumer install, native artifact build or real product host runs.
func TestNoDupeElseIfLogicalCoverage(t *testing.T) {
  tests := []struct {
    name      string
    source    string
    wantLines []int
  }{
    {
      name: "equal tokens ignore whitespace and comments",
      source: `if (value === 1) {}
else if (value===/* comment */1) {}`,
      wantLines: []int{2},
    },
    {
      name: "whole condition parentheses are transparent",
      source: `if (value === 1) {}
else if ((value === 1)) {}`,
      wantLines: []int{2},
    },
    {
      name: "earlier disjunction covers one operand",
      source: `if (a || b) {}
else if (a) {}`,
      wantLines: []int{2},
    },
    {
      name: "earlier operand covers later conjunction",
      source: `if (a) {}
else if (a && b) {}`,
      wantLines: []int{2},
    },
    {
      name: "separate earlier branches accumulate",
      source: `if (a) {}
else if (b) {}
else if (a || b) {}`,
      wantLines: []int{3},
    },
    {
      name: "and operands commute",
      source: `if (a && b) {}
else if (b && a) {}`,
      wantLines: []int{2},
    },
    {
      name: "or operands commute",
      source: `if (a || b) {}
else if (b || a) {}`,
      wantLines: []int{2},
    },
    {
      name: "nested logical operands commute and cover",
      source: `if ((a && (b || c)) || d) {}
else if ((c || b) && e && a) {}`,
      wantLines: []int{2},
    },
    {
      name: "one disjunction covers multiple later branches",
      source: `if (a || b) {}
else if (a) {}
else if (b) {}`,
      wantLines: []int{2, 3},
    },
    {
      name: "nested accumulated alternatives cover conjunction",
      source: `if (a) {}
else if (b) {}
else if (c && (a || d && b)) {}`,
      wantLines: []int{3},
    },
    {
      name: "overlapping disjunction stays executable",
      source: `if (a || b) {}
else if (a || c) {}`,
    },
    {
      name: "broader later disjunction stays executable",
      source: `if (a) {}
else if (a || b) {}`,
    },
    {
      name: "stricter earlier conjunction does not cover operand",
      source: `if (a && b) {}
else if (a) {}`,
    },
    {
      name: "accumulated disjunction with new operand stays executable",
      source: `if (a) {}
else if (b) {}
else if (a || b || c) {}`,
    },
    {
      name: "different token structure stays executable",
      source: `if (value === 1) {}
else if (value === (1)) {}`,
    },
    {
      name: "identifier and call stay distinct",
      source: `if (fn) {}
else if (fn()) {}`,
    },
    {
      name: "partially shared nested condition stays executable",
      source: `if (a) {}
else if (b && (a || c)) {}`,
    },
    {
      name: "independent nested if is not part of chain",
      source: `if (a) {}
if (a) {}`,
    },
  }

  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      file := parseTS(t, test.source)
      findings := NewEngine(RuleConfig{"no-dupe-else-if": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
      gotLines := make([]int, 0, len(findings))
      for _, finding := range findings {
        if finding.Message != "This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain." {
          t.Fatalf("unexpected message: %q", finding.Message)
        }
        gotLines = append(gotLines, shimscanner.GetECMALineOfPosition(file, finding.Pos)+1)
      }
      if len(gotLines) != len(test.wantLines) {
        t.Fatalf("finding lines = %v, want %v", gotLines, test.wantLines)
      }
      for i := range gotLines {
        if gotLines[i] != test.wantLines[i] {
          t.Fatalf("finding lines = %v, want %v", gotLines, test.wantLines)
        }
      }
    })
  }
}
