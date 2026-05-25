package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceRejectsDocumentChangesWorkspaceEdit verifies
// unsupported edit shapes fail loudly.
//
// ttscserver's sidecar contract currently accepts changes-only WorkspaceEdit
// objects. If a sidecar returns standard `documentChanges`, silently decoding
// that payload as an empty edit would make plugin authors think a command
// succeeded while VSCode applies nothing.
//
// 1. Build a fake sidecar that owns one command.
// 2. Have the command return `WorkspaceEdit.documentChanges`.
// 3. Execute the command through NativePluginSource.
// 4. Assert the bridge reports the unsupported field instead of returning `{}`.
func TestLSPNativePluginSourceRejectsDocumentChangesWorkspaceEdit(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceDocumentChangesSidecar)
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
  edit, err := source.ExecuteCommand("ttsc.fake.fix", nil)
  if err == nil {
    t.Fatalf("expected documentChanges rejection, got edit %#v", edit)
  }
  if !strings.Contains(err.Error(), "WorkspaceEdit.documentChanges") {
    t.Fatalf("error should name unsupported documentChanges, got %v", err)
  }
}

const nativePluginSourceDocumentChangesSidecar = `package main

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
    fmt.Println(` + "`" + `[]` + "`" + `)
  case "lsp-execute-command":
    fmt.Println(` + "`" + `{"documentChanges":[{"textDocument":{"uri":"file:///tmp/a.ts","version":1},"edits":[]}]}` + "`" + `)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
