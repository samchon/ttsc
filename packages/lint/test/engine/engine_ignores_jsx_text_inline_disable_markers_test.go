package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineIgnoresJsxTextInlineDisableMarkers verifies JSX text cannot create
// or close an inline lint range while expression-container comments still can.
//
// JSX text has a parser-owned lexical goal in which slash-shaped bytes are
// ordinary text. Treating those bytes as a block comment silently suppressed a
// real diagnostic, whereas `{/* ... */}` is genuine JavaScript comment trivia.
//
//  1. Put fake and real range-disable markers before separate `debugger` statements.
//  2. Put fake and real range-enable markers around two more statements.
//  3. Assert only the statements outside the genuine range are reported exactly.
func TestEngineIgnoresJsxTextInlineDisableMarkers(t *testing.T) {
  const ruleName = "no-debugger"
  source := "const fakeDisable = <div>/* eslint-disable no-debugger */</div>;\n" +
    "debugger;\n" +
    "const realDisable = <div>{/* eslint-disable no-debugger */}</div>;\n" +
    "debugger;\n" +
    "const fakeEnable = <div>/* eslint-enable no-debugger */</div>;\n" +
    "debugger;\n" +
    "const realEnable = <div>{/* eslint-enable no-debugger */}</div>;\n" +
    "debugger;\n" +
    "JSON.stringify([fakeDisable, realDisable, fakeEnable, realEnable]);\n"
  file := parseTSXFile(t, "/virtual/test.tsx", source)
  findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 2 {
    t.Fatalf("want 2 findings, got %d (%+v)", len(findings), findings)
  }
  starts := []int{
    strings.Index(source, "debugger;"),
    strings.LastIndex(source, "debugger;"),
  }
  for i, start := range starts {
    end := start + len("debugger;")
    if findings[i].Pos != start || findings[i].End != end {
      t.Fatalf("finding %d: want debugger range [%d,%d), got [%d,%d)", i, start, end, findings[i].Pos, findings[i].End)
    }
  }
}
