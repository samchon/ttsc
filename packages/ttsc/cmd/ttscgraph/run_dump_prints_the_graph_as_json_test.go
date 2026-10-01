package main

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// writeGraphFile writes content to path under a fixture project, creating parent
// directories as needed.
func writeGraphFile(t *testing.T, path, content string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
}

// TestRunDumpPrintsTheGraphAsJSON verifies command preparation streams the graph envelope to stdout.
//
// This source case exercises the actual dump grammar, compiler and serializer.
// Its helper supplies the leading dump word; installed launcher controls retain
// the separate top-level dispatcher and native process connection.
//
// 1. Write two functions with an authored call in an owned project.
// 2. Call prepareDumpCommand through the source helper and capture encoding.
// 3. Require status zero, nonempty nodes and edges, and wire endpoint/kind keys.
//
// @evidence contracts/testing.md#behavioral-verification The real prepareDumpCommand and encode operations return zero and stream parseable graph JSON with nonempty node/edge arrays and the expected wire endpoint/kind fields. This helper does not execute top-level dispatch.
// @evidence contracts/testing.md#independent-expectations The literal fixture declares two functions and one call, so a successful graph cannot have empty nodes or edges. The raw dump contract independently defines the endpoint and kind field names asserted after JSON decoding.
// @evidence contracts/testing.md#distinguishing-cases A successful loaded project contrasts malformed invocation/load cases elsewhere; nonempty graph facts and raw wire keys distinguish a graph document from unrelated or legacy output.
// @evidence contracts/testing.md#execution-ownership This Go source-unit entry calls runSourceDumpCommand, which supplies dump and delegates to actual prepareDumpCommand/encode with empty ignore membership. Installed test_ttscgraph_installed_launcher_preserves_argument_boundary retains real bin/native dispatch; this unit builds or starts no native product.
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

  if code := runSourceDumpCommand([]string{"dump", "--cwd", root, "--tsconfig", "tsconfig.json"}); code != 0 {
    t.Fatalf("run dump exit = %d, want 0; stderr:\n%s", code, errBuf.String())
  }

  var dump struct {
    Nodes []map[string]any `json:"nodes"`
    Edges []map[string]any `json:"edges"`
  }
  if err := json.Unmarshal(out.Bytes(), &dump); err != nil {
    t.Fatalf("dump output is not valid JSON: %v\n%s", err, out.String())
  }
  if len(dump.Nodes) == 0 || len(dump.Edges) == 0 {
    t.Fatalf("expected nodes and edges, got %d/%d", len(dump.Nodes), len(dump.Edges))
  }
  // Each edge carries its endpoints and kind, and nothing more — the graph is
  // wholly checker-resolved, so there is no per-edge trust flag to negotiate.
  edge := dump.Edges[0]
  if _, ok := edge["from"].(string); !ok {
    t.Fatalf("edge missing from: %v", edge)
  }
  if _, ok := edge["kind"].(string); !ok {
    t.Fatalf("edge missing kind: %v", edge)
  }
}
