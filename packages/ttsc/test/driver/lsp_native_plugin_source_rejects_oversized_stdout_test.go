package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceRejectsOversizedStdout verifies sidecar stdout is
// bounded before JSON decoding.
//
// A broken plugin must not be able to make ttscserver buffer arbitrary stdout
// while serving editor requests. The bridge should reject oversized output and
// log a bounded error instead of attempting to unmarshal it.
//
// 1. Build a fake sidecar with valid command discovery.
// 2. Have `lsp-code-actions` write more than the bridge stdout limit.
// 3. Assert no actions are returned and the log names the stdout limit failure.
func TestLSPNativePluginSourceRejectsOversizedStdout(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceOversizedStdoutSidecar)
  manifest, err := json.Marshal(driver.NativePluginManifest{
    LSPPlugins: []driver.NativeLSPPluginEntry{{Binary: sidecar, Name: "@ttsc/fake"}},
  })
  if err != nil {
    t.Fatal(err)
  }
  var errBuf bytes.Buffer
  source, err := driver.NewNativePluginSource(driver.NativePluginSourceOptions{
    Cwd:          dir,
    Err:          &errBuf,
    ManifestJSON: string(manifest),
    Tsconfig:     "tsconfig.json",
  })
  if err != nil {
    t.Fatalf("NewNativePluginSource failed: %v", err)
  }
  if actions := source.CodeActions("file:///tmp/a.ts", driver.LSPRange{}, driver.LSPCodeActionContext{}); len(actions) != 0 {
    t.Fatalf("oversized sidecar returned actions: %#v", actions)
  }
  if !strings.Contains(errBuf.String(), "produced more than") {
    t.Fatalf("missing oversized stdout log:\n%s", errBuf.String())
  }
}

const nativePluginSourceOversizedStdoutSidecar = `package main

import (
  "fmt"
  "os"
  "strings"
)

func main() {
  if len(os.Args) < 2 {
    os.Exit(2)
  }
  switch os.Args[1] {
  case "lsp-command-ids":
    fmt.Println(` + "`" + `["ttsc.fake.fix"]` + "`" + `)
  case "lsp-code-action-kinds":
    fmt.Println(` + "`" + `["source.fixAll.ttsc"]` + "`" + `)
  case "lsp-code-actions":
    fmt.Print(strings.Repeat("x", 6*1024*1024))
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
