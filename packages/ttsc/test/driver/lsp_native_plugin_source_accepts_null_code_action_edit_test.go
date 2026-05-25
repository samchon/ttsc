package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceAcceptsNullCodeActionEdit verifies `edit: null`
// does not count as a direct edit.
//
// Some LSP producers serialize absent optional fields as explicit JSON null.
// ttscserver rejects real direct edit payloads, but it should not drop an
// otherwise valid command-backed action just because the sidecar emitted
// `edit:null`.
//
// 1. Build a fake sidecar that returns a command-backed action with `edit:null`.
// 2. Ask NativePluginSource for code actions.
// 3. Assert the action survives.
func TestLSPNativePluginSourceAcceptsNullCodeActionEdit(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceNullEditSidecar)
  manifest, err := json.Marshal(driver.NativePluginManifest{
    LSPPlugins: []driver.NativeLSPPluginEntry{{Binary: sidecar, Name: "@ttsc/fake"}},
  })
  if err != nil {
    t.Fatal(err)
  }
  source, err := driver.NewNativePluginSource(driver.NativePluginSourceOptions{
    Cwd:          dir,
    ManifestJSON: string(manifest),
    Tsconfig:     "tsconfig.json",
  })
  if err != nil {
    t.Fatalf("NewNativePluginSource failed: %v", err)
  }
  actions := source.CodeActions("file:///tmp/a.ts", driver.LSPRange{}, driver.LSPCodeActionContext{})
  if len(actions) != 1 || actions[0].Command == nil || actions[0].Command.Command != "ttsc.fake.fix" {
    t.Fatalf("edit:null action was not preserved: %#v", actions)
  }
}

const nativePluginSourceNullEditSidecar = `package main

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
    fmt.Println(` + "`" + `[{"title":"Fake fix","kind":"source.fixAll.ttsc","edit":null,"command":{"title":"Fake fix","command":"ttsc.fake.fix"}}]` + "`" + `)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
