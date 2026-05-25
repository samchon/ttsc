package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceIgnoresDuplicateCommandID verifies the first
// command owner wins.
//
// `workspace/executeCommand` routing is single-owner. If two sidecars advertise
// the same command id, routing to the later one would make earlier code actions
// unpredictable, so duplicate ids are logged and ignored during discovery.
//
// 1. Build two fake sidecars that both advertise `ttsc.fake.fix`.
// 2. Construct NativePluginSource with both entries.
// 3. Execute the command.
// 4. Assert the first sidecar handles it and the duplicate is logged.
func TestLSPNativePluginSourceIgnoresDuplicateCommandID(t *testing.T) {
  dir := t.TempDir()
  first := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceDuplicateCommandFirstSidecar)
  second := buildNativePluginSourceTestSidecar(t, t.TempDir(), nativePluginSourceDuplicateCommandSecondSidecar)
  manifest, err := json.Marshal(driver.NativePluginManifest{
    LSPPlugins: []driver.NativeLSPPluginEntry{
      {Binary: first, Name: "@ttsc/first"},
      {Binary: second, Name: "@ttsc/second"},
    },
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
  edit, err := source.ExecuteCommand("ttsc.fake.fix", nil)
  if err != nil {
    t.Fatalf("ExecuteCommand failed: %v", err)
  }
  if got := edit.Changes["file:///tmp/a.ts"][0].NewText; got != "first" {
    t.Fatalf("expected first sidecar to own command, got edit %q", got)
  }
  if !strings.Contains(errBuf.String(), `duplicate LSP command id "ttsc.fake.fix"`) {
    t.Fatalf("missing duplicate-command log:\n%s", errBuf.String())
  }
}

const nativePluginSourceDuplicateCommandFirstSidecar = `package main

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
    fmt.Println(` + "`" + `{"changes":{"file:///tmp/a.ts":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"newText":"first"}]}}` + "`" + `)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`

const nativePluginSourceDuplicateCommandSecondSidecar = `package main

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
    fmt.Println(` + "`" + `{"changes":{"file:///tmp/a.ts":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"newText":"second"}]}}` + "`" + `)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
