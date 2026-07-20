package graph

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestDumpUsesECMALineTerminators verifies graph dump evidence and compact
// source display use the compiler's complete ECMAScript line model.
//
// The graph used to split only on LF, so a CR, LS, or PS file placed every
// declaration on line one and let a leading // comment consume the rest of the
// file. Each fixture drives a real compiler program and checks the independent
// dump coordinates, comment compaction, and regular-expression boundary.
//
// 1. Compile the same two-function project with each ECMAScript terminator.
// 2. Marshal its graph and find both declarations and the call edge.
// 3. Assert their evidence and source helpers agree on the three logical lines.
func TestDumpUsesECMALineTerminators(t *testing.T) {
  cases := []struct {
    name       string
    terminator string
  }{
    {name: "LF", terminator: "\n"},
    {name: "CRLF", terminator: "\r\n"},
    {name: "CR", terminator: "\r"},
    {name: "LS", terminator: "\u2028"},
    {name: "PS", terminator: "\u2029"},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      source := "// lead comment" + tc.terminator +
        "export function alpha(): number { return beta(); }" + tc.terminator +
        "export function beta(): number { return 1; }"
      root := t.TempDir()
      writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
      writeFile(t, filepath.Join(root, "src", "main.ts"), source)

      var dump Dump
      if err := json.Unmarshal(dumpBytes(t, root), &dump); err != nil {
        t.Fatalf("dump is not valid JSON: %v", err)
      }
      nodes := map[string]*DumpNode{}
      for i := range dump.Nodes {
        node := &dump.Nodes[i]
        if node.Kind == "function" {
          nodes[node.Name] = node
        }
      }
      for _, name := range []string{"alpha", "beta"} {
        node := nodes[name]
        if node == nil || node.Evidence == nil {
          t.Fatalf("missing %s evidence: %+v", name, dump.Nodes)
        }
      }
      if got := nodes["alpha"].Evidence; got.StartLine != 2 || got.StartCol != 1 {
        t.Fatalf("alpha evidence = line %d col %d, want line 2 col 1", got.StartLine, got.StartCol)
      }
      if got := nodes["beta"].Evidence; got.StartLine != 3 || got.StartCol != 1 {
        t.Fatalf("beta evidence = line %d col %d, want line 3 col 1", got.StartLine, got.StartCol)
      }

      var call *DumpEdge
      for i := range dump.Edges {
        edge := &dump.Edges[i]
        if edge.Kind == "calls" && edge.From == "src/main.ts#alpha:function" {
          call = edge
          break
        }
      }
      if call == nil || call.Evidence == nil || call.Evidence.StartLine != 2 {
        t.Fatalf("alpha call evidence = %+v, want line 2", call)
      }

      if lines := newLineStarts(source); len(lines) != 3 {
        t.Fatalf("line starts = %v, want three logical lines", lines)
      }
      if got := compactObjectMemberSignature("// lead" + tc.terminator + "value: 1"); got != "// lead"+tc.terminator+"value: 1" {
        t.Fatalf("compact signature = %q, want line comment to end before value", got)
      }
      if got := regularExpressionEnd("/line"+tc.terminator+"next/", 0); got != 0 {
        t.Fatalf("regular-expression end = %d, want reject a cross-line literal", got)
      }
    })
  }
}
