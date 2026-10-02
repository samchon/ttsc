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
//
// @evidence contracts/testing.md#behavioral-verification CodeActions returns no actions and logs produced more than when the fixture writes 6 MiB stdout.
// @evidence contracts/testing.md#independent-expectations The independent fixture exceeds the documented 4 MiB cap before JSON decoding; a bounded failure must replace arbitrary buffering.
// @evidence contracts/testing.md#distinguishing-cases Overflow is rejected while the separate exactly-at-limit diagnostics payload is accepted.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceRejectsOversizedStdout is a Go unit test in the test/driver process: the authored sidecar batch is built once, its fixture executables act as the sidecar test doubles, and the source's cleanup barrier joins each child before the fixture directory is removed; no installed consumer or built product CLI runs.
func TestLSPNativePluginSourceRejectsOversizedStdout(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceOversizedStdoutSidecar)
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
