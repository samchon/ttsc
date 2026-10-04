//go:build e2e

package driver_test

import (
  "bytes"
  _ "embed"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceDropsDirectCodeActionEdit verifies sidecar actions
// must route edits through owned commands.
//
// The native CodeActions boundary requires command-backed results and refuses
// a nonnull direct edit. This case observes that refusal, not editor buffer
// synchronization, version checks or command execution.
//
// 1. Build a fake sidecar that returns a CodeAction with an inline edit.
// 2. Ask NativePluginSource for code actions.
// 3. Assert the action is dropped and the bridge logs the rejection.
//
// @evidence contracts/testing.md#behavioral-verification CodeActions drops an inline WorkspaceEdit action and logs returned direct LSP edit.
// @evidence contracts/testing.md#independent-expectations The native action contract refuses nonnull direct edits and requires an owned command; the authored inline edit supplies the independent rejected neighbor of null.
// @evidence contracts/testing.md#distinguishing-cases A real nonnull edit is rejected while explicit edit:null with an owned command survives.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the real NativePluginSource child protocol using a built authored fixture and observes filtering plus the refusal log, without an installed editor or CLI.
// @evidence contracts/e2e.md#necessary-boundary The child emits an inline WorkspaceEdit through native code-actions JSON; the specific direct-edit log distinguishes rejection at that decoded boundary from a generic missing-command result.
// @evidence contracts/e2e.md#shared-execution This unchanged inline-edit fixture is one entry of the shared lazy dispatcher build; the case requests no separate compilation.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private source, cwd and error buffer isolate the case; unchanged sidecar bytes are reused, and cleanup establishes its supported completion barrier before removal or retains unresolved inputs.
// @evidence contracts/e2e.md#preserved-coverage The original nonnull edit and zero-action/direct-edit-log assertions remain here. The separate null-edit acceptance case supplies the positive neighbor; buffer synchronization and command effects are not inferred.
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

//go:embed testdata/native-plugin-source/direct-edit.go.txt
var nativePluginSourceDirectEditSidecar string
