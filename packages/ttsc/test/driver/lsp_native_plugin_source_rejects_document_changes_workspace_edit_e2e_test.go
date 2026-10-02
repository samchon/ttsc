//go:build e2e

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
//
// @evidence contracts/testing.md#behavioral-verification ExecuteCommand rejects the fixture documentChanges payload with an error naming WorkspaceEdit.documentChanges.
// @evidence contracts/testing.md#independent-expectations The supported native bridge accepts changes-only WorkspaceEdit; an unsupported field must not decode to a silent empty success.
// @evidence contracts/testing.md#distinguishing-cases A standard but unsupported edit shape differs from the valid changes map in the route and content cases.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceRejectsDocumentChangesWorkspaceEdit is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary NativePluginSource discovers and invokes actual fixture executables across argv/stdin/stdout/stderr and JSON; direct payload validation cannot establish process transport, framing or failed-exit capture for this response.
// @evidence contracts/e2e.md#shared-execution buildNativePluginSourceTestSidecar links all twelve authored fixture programs in one standard-library dispatcher build. Equal content-presence cases reuse the same fixture program; executable names select different payload producers. Discovery and operation each use separate synchronous child processes because the product sidecar protocol accepts one verb per process, and no per-case Go build remains.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each source and fixture cwd belong to this case. Its fixture owner installs an observer during cleanup and requests a completion refresh; the callback runs after native hint calls finish, closes the source and signals completion before fixture deletion. Close drops queued work and joins resident children; no full scheduler-goroutine join is claimed. A thirty-second wait reports failure and cancels the source, then a ten-second wait still requires the callback barrier. An unresolved barrier retains both the fixture and shared producer directory and fails the suite. The call-log environment is restored through t.Setenv. No cache invalidation is claimed.
// @evidence contracts/e2e.md#preserved-coverage This body retains its reviewed payload, command, edit, diagnostic, size or stream assertions and failure identity. The shared producer preserves each authored fixture verb body and deliberate failure; no assertion is replaced by metadata inspection and no portable assertion transfer is claimed.
func TestLSPNativePluginSourceRejectsDocumentChangesWorkspaceEdit(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceDocumentChangesSidecar)
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
