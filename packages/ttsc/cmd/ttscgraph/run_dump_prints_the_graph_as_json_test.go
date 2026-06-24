package main

import (
  "bytes"
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestRunDumpPrintsTheGraphAsJSON verifies the `dump` subcommand end to end: run
// dispatches it, it loads the project, builds the graph, and prints the export
// JSON to stdout with exit 0. This is the shipped path a user runs as
// `npx @ttsc/graph dump > graph.json` to feed the 3D viewer, so a regression that
// stops it printing, or makes it serve instead of exit, would break that flow
// silently.
//
//  1. Write a two-function fixture (one call) under a temp project.
//  2. run dump --cwd <root> --tsconfig tsconfig.json, capturing stdout.
//  3. Assert exit 0 and that stdout is the graph envelope with nodes and edges.
func TestRunDumpPrintsTheGraphAsJSON(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), `export function helper(): void {}
export function main(): void {
  helper();
}
`)

  oldStdout, oldStderr := stdout, stderr
  defer func() { stdout, stderr = oldStdout, oldStderr }()
  var out, errBuf bytes.Buffer
  stdout, stderr = &out, &errBuf

  if code := run([]string{"dump", "--cwd", root, "--tsconfig", "tsconfig.json"}); code != 0 {
    t.Fatalf("run dump exit = %d, want 0; stderr:\n%s", code, errBuf.String())
  }

  var dump struct {
    SchemaVersion int              `json:"schemaVersion"`
    Provenance    string           `json:"provenance"`
    Nodes         []map[string]any `json:"nodes"`
    Edges         []map[string]any `json:"edges"`
  }
  if err := json.Unmarshal(out.Bytes(), &dump); err != nil {
    t.Fatalf("dump output is not valid JSON: %v\n%s", err, out.String())
  }
  if dump.SchemaVersion != 1 {
    t.Fatalf("schemaVersion = %d, want 1", dump.SchemaVersion)
  }
  if dump.Provenance != "checker-resolved" {
    t.Fatalf("provenance = %q, want checker-resolved", dump.Provenance)
  }
  if len(dump.Nodes) == 0 || len(dump.Edges) == 0 {
    t.Fatalf("expected nodes and edges, got %d/%d", len(dump.Nodes), len(dump.Edges))
  }
}
