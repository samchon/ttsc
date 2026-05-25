package driver_test

import (
  "bytes"
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceAcceptsStdoutAtLimit verifies the stdout cap rejects
// overflow, not the exact boundary.
//
// The limited writer can hold exactly 4 MiB without truncation. Rejecting the
// boundary makes the contract stricter than the implementation needs and can
// turn a valid JSON payload into an error.
//
// 1. Build a sidecar whose diagnostics payload is padded to exactly 4 MiB.
// 2. Ask NativePluginSource for diagnostics.
// 3. Assert the payload decodes and no bridge error is logged.
func TestLSPNativePluginSourceAcceptsStdoutAtLimit(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceStdoutAtLimitSidecar)
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
  diagnostics := source.Diagnostics(driver.LSPDocumentVersion{URI: "file:///tmp/a.ts"})
  if len(diagnostics) != 1 || diagnostics[0].Message == "" {
    t.Fatalf("expected padded diagnostics payload to decode: %#v", diagnostics)
  }
  if errBuf.Len() != 0 {
    t.Fatalf("unexpected bridge stderr: %s", errBuf.String())
  }
}

const nativePluginSourceStdoutAtLimitSidecar = `package main

import (
  "fmt"
  "os"
  "strings"
)

const limit = 4 * 1024 * 1024

func main() {
  if len(os.Args) < 2 {
    os.Exit(2)
  }
  switch os.Args[1] {
  case "lsp-command-ids", "lsp-code-action-kinds":
    fmt.Println(` + "`" + `[]` + "`" + `)
  case "lsp-diagnostics":
    prefix := ` + "`" + `[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"source":"ttsc/fake","message":"` + "`" + `
    suffix := ` + "`" + `"}]` + "`" + `
    fmt.Print(prefix + strings.Repeat("x", limit-len(prefix)-len(suffix)) + suffix)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
