package mcp_test

import (
  "encoding/json"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestServerRepliesParseErrorForMalformedJson verifies that unparseable input
// draws a JSON-RPC parse-error reply rather than silence, so a client awaiting a
// response over stdio does not hang. The id is unrecoverable from broken JSON, so
// per JSON-RPC 2.0 §4.2 the reply carries a null id with error code -32700.
//
//  1. Build the server from a minimal one-file fixture.
//  2. Handle a malformed JSON message.
//  3. Assert ok==true, error.code == -32700, and id is null/absent.
func TestServerRepliesParseErrorForMalformedJson(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export const value: number = 1;
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected parse diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()
  server := mcp.NewServer(prog)

  out, ok := server.Handle([]byte("{not json}"))
  if !ok {
    t.Fatalf("malformed JSON drew no reply")
  }
  var envelope map[string]any
  if err := json.Unmarshal(out, &envelope); err != nil {
    t.Fatal(err)
  }
  errObj, ok := envelope["error"].(map[string]any)
  if !ok {
    t.Fatalf("malformed JSON reply had no error object: %s", out)
  }
  if errObj["code"] != float64(-32700) {
    t.Fatalf("parse error code was not -32700: %v", errObj["code"])
  }
  // JSON-RPC 2.0 §4.2 requires the id be present AND null, not merely absent — a
  // missing map key and an explicit null both read as nil, so check presence too.
  if id, present := envelope["id"]; !present || id != nil {
    t.Fatalf("parse error reply must carry a present, null id (present=%v, value=%v)", present, id)
  }
}
