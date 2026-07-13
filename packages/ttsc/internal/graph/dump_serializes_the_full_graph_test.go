package graph

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestMarshalDumpSerializesTheFullGraph verifies that MarshalDump projects a
// built graph onto the IGraphDump wire contract the `ttscgraph dump` command
// prints and the @ttsc/graph engine loads: the project envelope, every node and
// edge, project-relative paths, line/col evidence, and the lowercase wire keys.
//
// The Node/Edge structs carry no json tags, so dump.go's projection is the only
// thing standing between the Go fields and the wire. A regression there would
// ship keys or kinds the engine does not read, so the key and kind assertions
// are load-bearing, not cosmetic.
//
//  1. Build a two-function fixture with one call, so the dump has a node set and
//     a value-call edge.
//  2. Marshal it with source texts and assert the envelope, counts, and that the
//     call edge maps to kind "calls" with a line/col evidence span.
//  3. Assert paths are project-relative, the wire keys are the lowercase json
//     tags, every edge endpoint resolves to a dumped node, and --pretty indents.
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
  sources := SourceTexts(prog)

  data, err := MarshalDump(g, root, "tsconfig.json", nil, sources, false)
  if err != nil {
    t.Fatalf("MarshalDump: %v", err)
  }

  var dump Dump
  if err := json.Unmarshal(data, &dump); err != nil {
    t.Fatalf("dump is not valid JSON: %v\n%s", err, data)
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

  // Locate the two function nodes by their wire shape, and confirm paths and ids
  // are project-relative (no temp-dir prefix leaked).
  byID := make(map[string]DumpNode, len(dump.Nodes))
  var mainID, helperID string
  for _, n := range dump.Nodes {
    byID[n.ID] = n
    if n.Kind == "function" && n.Name == "main" {
      mainID = n.ID
    }
    if n.Kind == "function" && n.Name == "helper" {
      helperID = n.ID
    }
  }
  if mainID == "" || helperID == "" {
    t.Fatalf("missing main/helper function nodes: %v", dump.Nodes)
  }
  if mainID != "src/main.ts#main:function" {
    t.Fatalf("node id not project-relative: %q", mainID)
  }
  if byID[mainID].File != "src/main.ts" {
    t.Fatalf("node file not project-relative: %q", byID[mainID].File)
  }
  if byID[mainID].Evidence == nil || byID[mainID].Evidence.StartLine == 0 {
    t.Fatalf("main node missing line/col evidence: %+v", byID[mainID].Evidence)
  }

  // The main -> helper call maps to kind "calls" with a located evidence span.
  var call *DumpEdge
  for i := range dump.Edges {
    e := &dump.Edges[i]
    if e.From == mainID && e.To == helperID && e.Kind == "calls" {
      call = e
    }
  }
  if call == nil {
    t.Fatalf("no calls edge main -> helper in dump:\n%s", data)
  }
  // The edge's span carries no file: it is the file its `from` id names, which
  // the loader reconstructs (see ITtscGraphDump.IEdge). Sending the path a
  // second time on every edge is 17% of the document for a value the reader
  // already holds.
  if call.Evidence == nil || call.Evidence.StartLine == 0 {
    t.Fatalf("call edge missing line/col evidence: %+v", call.Evidence)
  }
  if call.Evidence.File != "" {
    t.Fatalf("call edge repeats the file its `from` id already names: %+v", call.Evidence)
  }
  if nodeFile(call.From) != "src/main.ts" {
    t.Fatalf("the edge's file is not recoverable from its from id: %q", call.From)
  }

  // Every edge endpoint resolves to a dumped node.
  for _, e := range dump.Edges {
    if _, ok := byID[e.From]; !ok {
      t.Fatalf("edge from %q has no dumped node", e.From)
    }
    if _, ok := byID[e.To]; !ok {
      t.Fatalf("edge to %q has no dumped node", e.To)
    }
  }

  // The wire keys are the lowercase json tags, not the Go field names.
  s := string(data)
  for _, key := range []string{`"id":`, `"kind":`, `"name":`, `"file":`, `"external":`, `"from":`, `"to":`} {
    if !strings.Contains(s, key) {
      t.Fatalf("dump missing wire key %s:\n%s", key, s)
    }
  }
  for _, leaked := range []string{`"ID":`, `"Kind":`, `"From":`, `"External":`} {
    if strings.Contains(s, leaked) {
      t.Fatalf("dump leaked Go field name %s:\n%s", leaked, s)
    }
  }
  // The dump carries no ceremony keys: it is wholly checker-resolved, so it has
  // no per-edge trust flags and no schema version to negotiate. It also carries
  // no keys the schema stopped promising: no inlined evidence text and no
  // diagnostics array.
  for _, gone := range []string{`"schemaVersion"`, `"provenance":`, `"confidence":`, `"text":`, `"diagnostics":`} {
    if strings.Contains(s, gone) {
      t.Fatalf("dump still emits removed key %s:\n%s", gone, s)
    }
  }

  pretty, err := MarshalDump(g, root, "tsconfig.json", nil, sources, true)
  if err != nil {
    t.Fatalf("MarshalDump pretty: %v", err)
  }
  if !strings.Contains(string(pretty), "\n  ") {
    t.Fatalf("--pretty output is not indented:\n%s", pretty)
  }
}
