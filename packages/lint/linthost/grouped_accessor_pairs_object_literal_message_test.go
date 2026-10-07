package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// TestGroupedAccessorPairsObjectLiteralMessage verifies split-pair detection
// reaches object literals — the gap issue #602 closed — and pins the
// `notGrouped` message plus the reported half.
//
// Before the fix `Visits()` named only class kinds, so an object literal whose
// get/set halves were separated by an unrelated member went unreported. The
// adjacent twin keeps a correctly grouped object-literal pair silent so the
// newly visited node kind cannot start over-reporting.
//
//  1. Enable grouped-accessor-pairs at error (default order).
//  2. Lint an object literal that splits `get total` and `set total`.
//  3. Assert one `notGrouped` finding on the trailing setter, and none for the
//     adjacent twin.
//
// @evidence contracts/testing.md#behavioral-verification Direct Engine findings require exactly one grouped-accessor-pairs error with the canonical message and trailing-setter line nine, plus zero findings for adjacency.
// @evidence contracts/testing.md#independent-expectations Authored object getter/bump/setter order independently splits the pair; the literal message and line identify the second accessor, not a computed snapshot.
// @evidence contracts/testing.md#distinguishing-cases Intervening bump reports; deleting that intervening member makes the matching accessors adjacent and clean. The corpus owns corresponding class forms.
// @evidence contracts/testing.md#execution-ownership TestGroupedAccessorPairsObjectLiteralMessage is selected in the shared Go unit population. It parses both actual object sources and calls NewEngineWithResolver.Run with the rule enabled. No installed consumer, native artifact build or real product host runs.
func TestGroupedAccessorPairsObjectLiteralMessage(t *testing.T) {
  const ruleName = "grouped-accessor-pairs"
  resolver := InlineRuleResolver{Rules: RuleConfig{ruleName: SeverityError}}

  split := "let counted = 0;\n" +
    "const o = {\n" +
    "  get total(): number {\n" +
    "    return counted;\n" +
    "  },\n" +
    "  bump(): void {\n" +
    "    counted += 1;\n" +
    "  },\n" +
    "  set total(next: number) {\n" +
    "    counted = next;\n" +
    "  },\n" +
    "};\n" +
    "JSON.stringify(o);\n"
  splitFile := parseTS(t, split)
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{splitFile}, nil)
  if len(findings) != 1 {
    t.Fatalf("split object literal: want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if findings[0].Rule != ruleName || findings[0].Severity != SeverityError {
    t.Fatalf("split object literal: rule mismatch: want %q, got %q", ruleName, findings[0].Rule)
  }
  if findings[0].Message != "Accessor pair should be grouped." {
    t.Fatalf("split object literal: message mismatch: got %q", findings[0].Message)
  }
  if line := shimscanner.GetECMALineOfPosition(splitFile, findings[0].Pos) + 1; line != 9 {
    t.Fatalf("split object literal: reported line: want 9 (the trailing setter), got %d", line)
  }

  adjacent := "let counted = 0;\n" +
    "const o = {\n" +
    "  get total(): number {\n" +
    "    return counted;\n" +
    "  },\n" +
    "  set total(next: number) {\n" +
    "    counted = next;\n" +
    "  },\n" +
    "};\n" +
    "JSON.stringify(o);\n"
  adjacentFile := parseTS(t, adjacent)
  adjacentFindings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{adjacentFile}, nil)
  if len(adjacentFindings) != 0 {
    t.Fatalf("adjacent object literal: want 0 findings, got %d (%+v)", len(adjacentFindings), adjacentFindings)
  }
}
