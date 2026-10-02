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
//
// @evidence contracts/testing.md#behavioral-verification CodeActions retains the owned command-backed action whose edit is explicitly null.
// @evidence contracts/testing.md#independent-expectations LSP optional edit null is absence, while the advertised command remains executable.
// @evidence contracts/testing.md#distinguishing-cases Explicit null is the accepted neighbor of the rejected nonnull direct edit.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceAcceptsNullCodeActionEdit is a Go unit test in the test/driver process: the authored sidecar batch is built once, its fixture executables act as the sidecar test doubles, and the source's cleanup barrier joins each child before the fixture directory is removed; no installed consumer or built product CLI runs.
func TestLSPNativePluginSourceAcceptsNullCodeActionEdit(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceNullEditSidecar)
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
  fixture.source = source
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
