package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceDropsUnownedCodeActionCommand verifies sidecar code
// actions cannot advertise commands the sidecar did not claim.
//
// `ExecuteCommand` routes through the command-owner map discovered from
// `lsp-command-ids`. Returning actions with undiscovered command ids would give
// the editor buttons that later fall through or execute against the wrong
// sidecar.
//
// 1. Build a fake sidecar that owns `ttsc.fake.fix`.
// 2. Have it return a code action for `ttsc.fake.other`.
// 3. Assert the action is dropped and the bridge logs the unowned command.
func TestLSPNativePluginSourceDropsUnownedCodeActionCommand(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceUnownedCommandSidecar)
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
    t.Fatalf("unowned action was not dropped: %#v", actions)
  }
  if !strings.Contains(errBuf.String(), `unowned LSP command "ttsc.fake.other"`) {
    t.Fatalf("missing unowned-command log:\n%s", errBuf.String())
  }
}

const nativePluginSourceUnownedCommandSidecar = `package main

import (
  "fmt"
  "os"
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
    fmt.Println(` + "`" + `[{"title":"Bad","kind":"source.fixAll.ttsc","command":{"title":"Bad","command":"ttsc.fake.other"}}]` + "`" + `)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
