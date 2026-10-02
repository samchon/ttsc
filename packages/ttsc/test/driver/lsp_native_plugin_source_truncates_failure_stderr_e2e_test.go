//go:build e2e

package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceTruncatesFailureStderr verifies sidecar stderr is
// bounded on failed LSP verbs.
//
// Plugin processes are editor-facing in `ttscserver`; a broken sidecar should
// not be able to make the server retain arbitrary stderr while formatting the
// error log. The bridge caps stderr and marks the message as truncated.
//
// 1. Build a fake sidecar with valid discovery verbs.
// 2. Have `lsp-code-actions` write large stderr and exit non-zero.
// 3. Assert no actions are returned and the log is truncated.
//
// @evidence contracts/testing.md#behavioral-verification A failing fixture writes 2 MiB stderr; CodeActions returns no actions, logs stderr truncated and stays below 1 MiB plus diagnostic overhead.
// @evidence contracts/testing.md#independent-expectations The documented stderr cap and deliberate nonzero fixture exit provide independent failure expectations.
// @evidence contracts/testing.md#distinguishing-cases Large stderr on failure differs from oversized successful stdout and exact-capacity valid JSON.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceTruncatesFailureStderr is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary NativePluginSource discovers and invokes actual fixture executables across argv/stdin/stdout/stderr and JSON; direct payload validation cannot establish process transport, framing or failed-exit capture for this response.
// @evidence contracts/e2e.md#shared-execution buildNativePluginSourceTestSidecar links all twelve authored fixture programs in one standard-library dispatcher build. Equal content-presence cases reuse the same fixture program; executable names select different payload producers. Discovery and operation each use separate synchronous child processes because the product sidecar protocol accepts one verb per process, and no per-case Go build remains.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each source and fixture cwd belong to this case. Its fixture owner installs an observer during cleanup and requests a completion refresh; the callback runs after native hint calls finish, closes the source and signals completion before fixture deletion. Close drops queued work and joins resident children; no full scheduler-goroutine join is claimed. A thirty-second wait reports failure and cancels the source, then a ten-second wait still requires the callback barrier. An unresolved barrier retains both the fixture and shared producer directory and fails the suite. The call-log environment is restored through t.Setenv. No cache invalidation is claimed.
// @evidence contracts/e2e.md#preserved-coverage This body retains its reviewed payload, command, edit, diagnostic, size or stream assertions and failure identity. The shared producer preserves each authored fixture verb body and deliberate failure; no assertion is replaced by metadata inspection and no portable assertion transfer is claimed.
func TestLSPNativePluginSourceTruncatesFailureStderr(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceOversizedStderrSidecar)
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
    t.Fatalf("stderr-failing sidecar returned actions: %#v", actions)
  }
  log := errBuf.String()
  if !strings.Contains(log, "stderr truncated") {
    t.Fatalf("missing stderr truncation marker:\n%s", log)
  }
  if len(log) > 1024*1024+4096 {
    t.Fatalf("stderr log was not bounded: %d bytes", len(log))
  }
}

const nativePluginSourceOversizedStderrSidecar = `package main

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
    fmt.Fprint(os.Stderr, strings.Repeat("x", 2*1024*1024))
    os.Exit(1)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
