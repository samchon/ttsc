package graph

import (
  "encoding/json"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDumpEvidenceSkipsLeadingTrivia verifies that a node's and an edge's
// evidence line/column point at the code, not the leading trivia, because
// tsgo's Pos() is the full-start (it includes the doc comment and indentation
// before a token).
//
// A declaration preceded by a doc comment and a call indented under its function
// are the two shapes that break a naive Pos->line/col: the node would land on the
// comment line and the edge column on the indentation. The dump skips leading
// whitespace and `//` / `/* */` comments first, so this pins both to the real
// token start.
//
//  1. Compile a fixture where `main` carries a block doc comment and calls
//     `helper()` indented two spaces.
//  2. Build and marshal the dump.
//  3. Assert the `main` node's evidence starts on the `export function main`
//     line, and the calls edge's evidence is the indented call's line and column.
func TestDumpEvidenceSkipsLeadingTrivia(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function helper(): void {}
/**
 * doc for main
 */
export function main(): void {
  helper();
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  g := Build(prog)
  data, err := MarshalDump(g, root, "tsconfig.json", nil, SourceTexts(prog), false)
  if err != nil {
    t.Fatalf("MarshalDump: %v", err)
  }
  var dump Dump
  if err := json.Unmarshal(data, &dump); err != nil {
    t.Fatalf("dump is not valid JSON: %v", err)
  }

  // The `main` declaration starts on line 5 — past its three-line doc comment —
  // not on line 2 where the comment (its leading trivia) begins.
  var main *DumpNode
  for i := range dump.Nodes {
    if dump.Nodes[i].Kind == "function" && dump.Nodes[i].Name == "main" {
      main = &dump.Nodes[i]
    }
  }
  if main == nil || main.Evidence == nil {
    t.Fatalf("missing main node with evidence: %+v", dump.Nodes)
  }
  if main.Evidence.StartLine != 5 {
    t.Fatalf("main evidence startLine = %d, want 5 (past the doc comment)", main.Evidence.StartLine)
  }

  // The `helper()` call sits on line 6, indented two spaces, so the edge
  // evidence is line 6 column 3 — not line 5 (where the trivia begins) or
  // column 1 (the indentation).
  var call *DumpEdge
  for i := range dump.Edges {
    e := &dump.Edges[i]
    if e.Kind == "calls" && e.From == "src/main.ts#main:function" {
      call = e
    }
  }
  if call == nil || call.Evidence == nil {
    t.Fatalf("missing calls edge with evidence: %+v", dump.Edges)
  }
  if call.Evidence.StartLine != 6 || call.Evidence.StartCol != 3 {
    t.Fatalf(
      "call evidence = line %d col %d, want line 6 col 3 (the indented call)",
      call.Evidence.StartLine, call.Evidence.StartCol,
    )
  }
}
