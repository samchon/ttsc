package graph

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestMarshalDumpSerializesTheFullGraph verifies that MarshalDump projects a
// built two-function graph to JSON with selected envelope, node and call-edge
// facts, count agreement, endpoint membership and key checks. No graph engine
// or CLI consumes this output, and counts alone do not certify fact identity.
//
//  1. Build a two-function fixture with one call, so the dump has a node set and
//     a value-call edge.
//  2. Marshal it with source texts and assert the envelope, counts, and that the
//     call edge maps to kind "calls" with a line/col evidence span.
//  3. Assert paths are project-relative, the wire keys are the lowercase json
//     tags, every edge endpoint resolves to a dumped node, and pretty=true indents.
//
// @evidence contracts/testing.md#behavioral-verification Actual compact MarshalDump JSON must decode selected project/tsconfig, main/helper and call facts, match the built graph's node/edge counts, contain every edge endpoint and selected lowercase keys, and omit selected Go-field/trust/text keys. Evidence checks require positive start lines, not columns or exact spans. pretty=true must produce indentation; no consumer loader or CLI runs.
// @evidence contracts/testing.md#independent-expectations Literal tsconfig.json, main ID/file, calls relation, key presence/absence, omitted edge evidence File, endpoint membership and indentation expectations are checked. Counts are derived from the built graph and prove only count agreement, not identity preservation. Project equality reuses canonicalDumpPath and nodeFile decodes the actual edge ID, so neither is an independent filesystem/ID oracle; positive evidence lines do not authenticate exact coordinates.
// @evidence contracts/testing.md#distinguishing-cases One authored main/helper call provides positive nodes, edge and evidence; selected forbidden keys and missing endpoint identities are negative guards. Compact versus pretty serialization contrasts formatting. Other graph payload families and empty/error cases are not owned here.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly calls Build, SourceTexts and compact/pretty MarshalDump, decoding actual JSON and re-encoding edge records. A restored empty linked-plugin manifest excludes ambient hooks; no installed consumer or product process runs.
func TestMarshalDumpSerializesTheFullGraph(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

  data, err := MarshalDump(g, root, "tsconfig.json", nil, sources, DumpOrigin{}, false)
  if err != nil {
    t.Fatalf("MarshalDump: %v", err)
  }

  var dump Dump
  if err := json.Unmarshal(data, &dump); err != nil {
    t.Fatalf("dump is not valid JSON: %v\n%s", err, data)
  }
  if dump.Project != canonicalDumpPath(root) || dump.Tsconfig != "tsconfig.json" {
    t.Fatalf("project/tsconfig coordinates are not canonical: %q / %q", dump.Project, dump.Tsconfig)
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
  // second time on every edge would bloat the document with a value the reader
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
  // Selected trust/text keys must not appear in this fixture's JSON, and no
  // decoded edge may serialize a per-edge provenance key.
  for _, gone := range []string{`"confidence":`, `"text":`} {
    if strings.Contains(s, gone) {
      t.Fatalf("dump still emits removed key %s:\n%s", gone, s)
    }
  }
  for _, edge := range dump.Edges {
    encoded, err := json.Marshal(edge)
    if err != nil {
      t.Fatalf("marshal edge %s->%s: %v", edge.From, edge.To, err)
    }
    if strings.Contains(string(encoded), `"provenance"`) {
      t.Fatalf("edge regained a per-edge trust flag:\n%s", encoded)
    }
  }

  pretty, err := MarshalDump(g, root, "tsconfig.json", nil, sources, DumpOrigin{}, true)
  if err != nil {
    t.Fatalf("MarshalDump pretty: %v", err)
  }
  if !strings.Contains(string(pretty), "\n  ") {
    t.Fatalf("--pretty output is not indented:\n%s", pretty)
  }
}
