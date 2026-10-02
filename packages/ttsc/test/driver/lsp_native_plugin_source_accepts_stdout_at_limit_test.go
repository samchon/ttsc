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
//
// @evidence contracts/testing.md#behavioral-verification Diagnostics decodes one diagnostic from an exactly 4 MiB response and logs no error.
// @evidence contracts/testing.md#independent-expectations The documented stdout bound is inclusive; the fixture independently pads its authored JSON to that exact byte size.
// @evidence contracts/testing.md#distinguishing-cases Exact capacity is accepted; the separate oversized stdout case exceeds the cap. Message nonemptiness does not require exact padded contents.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceAcceptsStdoutAtLimit is a Go unit test in the test/driver process: the authored sidecar batch is built once, its fixture executables act as the sidecar test doubles, and the source's cleanup barrier joins each child before the fixture directory is removed; no installed consumer or built product CLI runs.
func TestLSPNativePluginSourceAcceptsStdoutAtLimit(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceStdoutAtLimitSidecar)
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
  diagnostics := source.Diagnostics(driver.LSPDocumentVersion{URI: "file:///tmp/a.ts"})
  if len(diagnostics.Document) != 1 || diagnostics.Document[0].Message == "" {
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
