package linthost

import (
  "sort"
  "strconv"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRunParallelMatchesSerialFindingSet verifies that the engine's
// parallel file walk produces the same set of findings as the serial walk.
//
// Engine.Run dispatches each user source file to a goroutine when no
// type-aware rule is active and SetSerial was not set. Per-file Contexts
// are rebuilt locally, so each goroutine writes only to its own findings
// slice; the merge step concatenates per-file slices in source-file order.
// This pins that contract: parallel and serial paths return the same
// findings (order-independent), with no doubles and no drops, on a
// multi-file program.
//
//  1. Parse three virtual files each containing `noVar` violations.
//  2. Run the engine in serial mode, capture each finding's path + rule.
//  3. Run the engine in parallel mode against the same files; sort both
//     finding lists by (path, rule, pos) and assert they match.
func TestEngineRunParallelMatchesSerialFindingSet(t *testing.T) {
  files := []*shimast.SourceFile{
    parseTSFile(t, "/virtual/a.ts", "var a = 1;\n"),
    parseTSFile(t, "/virtual/b.ts", "var b = 2;\nvar bb = 3;\n"),
    parseTSFile(t, "/virtual/c.ts", "let c = 4;\nvar c2 = 5;\n"),
  }

  serial := NewEngine(RuleConfig{"noVar": SeverityError})
  serial.SetSerial(true)
  serialFindings := serial.Run(files, nil)
  if got, want := len(serialFindings), 4; got != want {
    t.Fatalf("serial run: want %d findings, got %d (%v)", want, got, findingRules(serialFindings))
  }

  parallel := NewEngine(RuleConfig{"noVar": SeverityError})
  parallelFindings := parallel.Run(files, nil)
  if got, want := len(parallelFindings), 4; got != want {
    t.Fatalf("parallel run: want %d findings, got %d (%v)", want, got, findingRules(parallelFindings))
  }

  if parallelFindingFingerprint(serialFindings) != parallelFindingFingerprint(parallelFindings) {
    t.Fatalf(
      "parallel finding set diverged from serial:\n  serial:   %s\n  parallel: %s",
      parallelFindingFingerprint(serialFindings), parallelFindingFingerprint(parallelFindings),
    )
  }
}

// parallelFindingFingerprint renders a finding slice as a sorted joined
// string keyed on (file, rule, position) so the comparison is independent
// of the order goroutines happen to complete in.
func parallelFindingFingerprint(findings []*Finding) string {
  rows := make([]string, 0, len(findings))
  for _, f := range findings {
    name := ""
    if f.File != nil {
      name = f.File.FileName()
    }
    rows = append(rows, name+"|"+f.Rule+"|"+strconv.Itoa(f.Pos))
  }
  sort.Strings(rows)
  return strings.Join(rows, "\n")
}
