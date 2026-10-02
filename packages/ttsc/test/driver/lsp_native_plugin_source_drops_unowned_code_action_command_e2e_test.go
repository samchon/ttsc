//go:build e2e

package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceDropsUnownedCodeActionCommand verifies sidecar code
// actions cannot advertise commands the sidecar did not claim.
//
// `ExecuteCommand` routes through the command-owner map discovered from
// `lsp-command-ids`. Returning actions with undiscovered command ids would give
// the editor buttons that later fall through or execute against the wrong
// sidecar.
//
// 1. Build a fake sidecar that owns `ttsc.fake.fix`.
// 2. Have it return a code action for `ttsc.fake.other`.
// 3. Assert the action is dropped and the bridge logs the unowned command.
//
// @evidence contracts/testing.md#behavioral-verification CodeActions drops ttsc.fake.other when discovery advertised only ttsc.fake.fix and logs the unowned command.
// @evidence contracts/testing.md#independent-expectations Command routing authority comes from discovered command IDs, not an arbitrary returned action.
// @evidence contracts/testing.md#distinguishing-cases A different unowned ID distinguishes this rejection from a missing command and from the valid advertised command in the route case.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceDropsUnownedCodeActionCommand is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary NativePluginSource discovers and invokes actual fixture executables across argv/stdin/stdout/stderr and JSON; direct payload validation cannot establish process transport, framing or failed-exit capture for this response.
// @evidence contracts/e2e.md#shared-execution buildNativePluginSourceTestSidecar links all twelve authored fixture programs in one standard-library dispatcher build. Equal content-presence cases reuse the same fixture program; executable names select different payload producers. Discovery and operation each use separate synchronous child processes because the product sidecar protocol accepts one verb per process, and no per-case Go build remains.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each source and fixture cwd belong to this case. Its fixture owner installs an observer during cleanup and requests a completion refresh; the callback runs after native hint calls finish, closes the source and signals completion before fixture deletion. Close drops queued work and joins resident children; no full scheduler-goroutine join is claimed. A thirty-second wait reports failure and cancels the source, then a ten-second wait still requires the callback barrier. An unresolved barrier retains both the fixture and shared producer directory and fails the suite. The call-log environment is restored through t.Setenv. No cache invalidation is claimed.
// @evidence contracts/e2e.md#preserved-coverage This body retains its reviewed payload, command, edit, diagnostic, size or stream assertions and failure identity. The shared producer preserves each authored fixture verb body and deliberate failure; no assertion is replaced by metadata inspection and no portable assertion transfer is claimed.
func TestLSPNativePluginSourceDropsUnownedCodeActionCommand(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceUnownedCommandSidecar)
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
    t.Fatalf("unowned action was not dropped: %#v", actions)
  }
  if !strings.Contains(errBuf.String(), `unowned LSP command "ttsc.fake.other"`) {
    t.Fatalf("missing unowned-command log:\n%s", errBuf.String())
  }
}

const nativePluginSourceUnownedCommandSidecar = `package main

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
    fmt.Println(` + "`" + `[{"title":"Bad","kind":"source.fixAll.ttsc","command":{"title":"Bad","command":"ttsc.fake.other"}}]` + "`" + `)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
