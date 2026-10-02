package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceDropsDirectCodeActionEdit verifies sidecar actions
// must route edits through owned commands.
//
// ttscserver currently runs plugin LSP sidecars against saved files, not the
// editor's in-memory buffer. Direct `edit` actions would bypass command
// ownership and stale-edit checks, so the bridge drops them until the protocol
// grows a version-aware direct-edit contract.
//
// 1. Build a fake sidecar that returns a CodeAction with an inline edit.
// 2. Ask NativePluginSource for code actions.
// 3. Assert the action is dropped and the bridge logs the rejection.
//
// @evidence contracts/testing.md#behavioral-verification CodeActions drops an inline WorkspaceEdit action and logs returned direct LSP edit.
// @evidence contracts/testing.md#independent-expectations The saved-file sidecar contract routes changes through owned commands and cannot certify version-aware direct edits.
// @evidence contracts/testing.md#distinguishing-cases A real nonnull edit is rejected while explicit edit:null with an owned command survives.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceDropsDirectCodeActionEdit is a Go unit test in the test/driver process: the authored sidecar batch is built once, its fixture executables act as the sidecar test doubles, and the source's cleanup barrier joins each child before the fixture directory is removed; no installed consumer or built product CLI runs.
func TestLSPNativePluginSourceDropsDirectCodeActionEdit(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceDirectEditSidecar)
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
  fixture.source = source
  if actions := source.CodeActions("file:///tmp/a.ts", driver.LSPRange{}, driver.LSPCodeActionContext{}); len(actions) != 0 {
    t.Fatalf("direct-edit action was not dropped: %#v", actions)
  }
  if !strings.Contains(errBuf.String(), "returned direct LSP edit") {
    t.Fatalf("missing direct-edit log:\n%s", errBuf.String())
  }
}

const nativePluginSourceDirectEditSidecar = `package main

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
    fmt.Println(` + "`" + `[{"title":"Inline edit","kind":"quickfix","edit":{"changes":{"file:///tmp/a.ts":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"newText":"x"}]}}}]` + "`" + `)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
