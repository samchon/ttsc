package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceDropsCommandlessCodeAction verifies inert actions
// are not forwarded to the editor.
//
// The current ttscserver LSP protocol supports command-backed actions only and
// does not implement codeAction/resolve. A sidecar action without a command or
// supported edit cannot do anything useful in the editor.
//
// 1. Build a fake sidecar that returns a title-only code action.
// 2. Ask NativePluginSource for code actions.
// 3. Assert the action is dropped and logged.
func TestLSPNativePluginSourceDropsCommandlessCodeAction(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceCommandlessActionSidecar)
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
    t.Fatalf("commandless action was not dropped: %#v", actions)
  }
  if !strings.Contains(errBuf.String(), "returned commandless LSP action") {
    t.Fatalf("missing commandless-action log:\n%s", errBuf.String())
  }
}

const nativePluginSourceCommandlessActionSidecar = `package main

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
    fmt.Println(` + "`" + `["quickfix"]` + "`" + `)
  case "lsp-code-actions":
    fmt.Println(` + "`" + `[{"title":"Inert","kind":"quickfix"}]` + "`" + `)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
