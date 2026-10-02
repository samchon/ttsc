//go:build e2e

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
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceRejectsOversizedStdout is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary NativePluginSource discovers and invokes actual fixture executables across argv/stdin/stdout/stderr and JSON; direct payload validation cannot establish process transport, framing or failed-exit capture for this response.
// @evidence contracts/e2e.md#shared-execution buildNativePluginSourceTestSidecar links all twelve authored fixture programs in one standard-library dispatcher build. Equal content-presence cases reuse the same fixture program; executable names select different payload producers. Discovery and operation each use separate synchronous child processes because the product sidecar protocol accepts one verb per process, and no per-case Go build remains.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each source and fixture cwd belong to this case. Its fixture owner installs an observer during cleanup and requests a completion refresh; the callback runs after native hint calls finish, closes the source and signals completion before fixture deletion. Close drops queued work and joins resident children; no full scheduler-goroutine join is claimed. A thirty-second wait reports failure and cancels the source, then a ten-second wait still requires the callback barrier. An unresolved barrier retains both the fixture and shared producer directory and fails the suite. The call-log environment is restored through t.Setenv. No cache invalidation is claimed.
// @evidence contracts/e2e.md#preserved-coverage This body retains its reviewed payload, command, edit, diagnostic, size or stream assertions and failure identity. The shared producer preserves each authored fixture verb body and deliberate failure; no assertion is replaced by metadata inspection and no portable assertion transfer is claimed.
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
