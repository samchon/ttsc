package graph

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestMarshalDumpSerializesTheFullGraph verifies that MarshalDump projects a
// built graph onto the export JSON the `ttscgraph dump` command prints and the
// web viewer parses: the schema envelope, every node and edge (none of the MCP
// response caps), and the lowercase wire keys.
//
// The Node/Edge structs carry no json tags, so dump.go's tags are the only thing
// standing between the Go field names and the wire. A regression there would
// ship `"ID"`/`"Kind"` keys the viewer does not read, so the key assertions are
// load-bearing, not cosmetic.
//
//  1. Build a two-function fixture with one call, so the dump has a node set and
//     a value-call edge.
//  2. Marshal it and assert the counts match the graph and the envelope is right.
//  3. Assert the wire keys are the lowercase json tags, every edge endpoint
//     resolves to a dumped node, and --pretty indents.
func TestMarshalDumpSerializesTheFullGraph(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function helper(): void {}
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

  data, err := MarshalDump(g, root, "tsconfig.json", nil, false)
  if err != nil {
    t.Fatalf("MarshalDump: %v", err)
  }

  var dump Dump
  if err := json.Unmarshal(data, &dump); err != nil {
    t.Fatalf("dump is not valid JSON: %v\n%s", err, data)
  }
  if dump.SchemaVersion != 1 {
    t.Fatalf("schemaVersion = %d, want 1", dump.SchemaVersion)
  }
  if dump.Provenance != Provenance {
    t.Fatalf("provenance = %q, want %q", dump.Provenance, Provenance)
  }
  if dump.Project != root || dump.Tsconfig != "tsconfig.json" {
    t.Fatalf("project/tsconfig not echoed: %q / %q", dump.Project, dump.Tsconfig)
  }
  if len(dump.Nodes) != len(g.Nodes) {
    t.Fatalf("dumped %d nodes, graph has %d", len(dump.Nodes), len(g.Nodes))
  }
  if len(dump.Edges) != len(g.Edges) {
    t.Fatalf("dumped %d edges, graph has %d", len(dump.Edges), len(g.Edges))
  }

  // Every edge endpoint must resolve to a dumped node, and the main -> helper
  // value-call edge must be present.
  byID := make(map[string]DumpNode, len(dump.Nodes))
  for _, n := range dump.Nodes {
    byID[n.ID] = n
  }
  var sawValueCall bool
  for _, e := range dump.Edges {
    if _, ok := byID[e.From]; !ok {
      t.Fatalf("edge from %q has no dumped node", e.From)
    }
    if _, ok := byID[e.To]; !ok {
      t.Fatalf("edge to %q has no dumped node", e.To)
    }
    if e.Kind == string(EdgeValueCall) {
      sawValueCall = true
    }
  }
  if !sawValueCall {
    t.Fatalf("no value-call edge in dump:\n%s", data)
  }

  // The wire keys are the lowercase json tags, not the Go field names.
  s := string(data)
  for _, key := range []string{`"schemaVersion"`, `"provenance"`, `"id":`, `"kind":`, `"external":`, `"from":`, `"to":`} {
    if !strings.Contains(s, key) {
      t.Fatalf("dump missing wire key %s:\n%s", key, s)
    }
  }
  for _, leaked := range []string{`"ID":`, `"Kind":`, `"From":`, `"External":`} {
    if strings.Contains(s, leaked) {
      t.Fatalf("dump leaked Go field name %s:\n%s", leaked, s)
    }
  }

  pretty, err := MarshalDump(g, root, "tsconfig.json", nil, true)
  if err != nil {
    t.Fatalf("MarshalDump pretty: %v", err)
  }
  if !strings.Contains(string(pretty), "\n  ") {
    t.Fatalf("--pretty output is not indented:\n%s", pretty)
  }
}
