//go:build e2e

package driver_test

import (
  _ "embed"
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceAcceptsNullCodeActionEdit verifies `edit: null`
// does not count as a direct edit.
//
// Some LSP producers serialize absent optional fields as explicit JSON null.
// ttscserver rejects real direct edit payloads, but it should not drop an
// otherwise valid command-backed action just because the sidecar emitted
// `edit:null`.
//
// 1. Build a fake sidecar that returns a command-backed action with `edit:null`.
// 2. Ask NativePluginSource for code actions.
// 3. Assert the action survives.
//
// @evidence contracts/testing.md#behavioral-verification CodeActions retains the owned command-backed action whose edit is explicitly null.
// @evidence contracts/testing.md#independent-expectations The native command-backed action policy treats a null edit as absent and retains the authored advertised command ID; this case does not execute that command or certify general protocol validity.
// @evidence contracts/testing.md#distinguishing-cases Explicit null is the accepted neighbor of the rejected nonnull direct edit.
// @evidence contracts/testing.md#execution-ownership Go test/driver calls the owning NativePluginSource with a built authored sidecar through real child argv and JSON output; this is a native protocol boundary, not a portable unit call or installed CLI test.
// @evidence contracts/e2e.md#necessary-boundary Actual command discovery and code-action JSON cross the selected sidecar process into NativePluginSource ownership filtering; a predicate-only unit would not detect lost responses or incorrect command ownership at this connection.
// @evidence contracts/e2e.md#shared-execution The package's lazy sync.Once dispatcher build supplies this static null-edit fixture alongside the other authored sidecars; no separate build is requested for this input.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture's native cwd and source are case-owned; unchanged dispatcher bytes are shared, while cleanup waits for the supported source completion barrier before deletion and retains inputs on unresolved completion. No whole descendant or scheduler join is certified.
// @evidence contracts/e2e.md#preserved-coverage The original edit:null input, one-action result and exact ttsc.fake.fix command assertion remain here; neighboring nonnull-edit rejection is a separate boundary case and no command execution result is inferred.
func TestLSPNativePluginSourceAcceptsNullCodeActionEdit(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceNullEditSidecar)
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
  actions := source.CodeActions("file:///tmp/a.ts", driver.LSPRange{}, driver.LSPCodeActionContext{})
  if len(actions) != 1 || actions[0].Command == nil || actions[0].Command.Command != "ttsc.fake.fix" {
    t.Fatalf("edit:null action was not preserved: %#v", actions)
  }
}

//go:embed testdata/native-plugin-source/null-edit.go.txt
var nativePluginSourceNullEditSidecar string
