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
// @evidence contracts/testing.md#execution-ownership Go test/driver crosses the actual NativePluginSource discovery and code-actions child protocol using a built static fixture; it observes the returned list and log without running an editor or the rejected command.
// @evidence contracts/e2e.md#necessary-boundary The selected child advertises fix but returns other; native discovery ownership and decoded action filtering must agree across two verbs, which a local membership predicate alone cannot establish.
// @evidence contracts/e2e.md#shared-execution This unowned-command fixture shares the existing lazy dispatcher build with the other unchanged native sidecar inputs, without a separate build.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private source, cwd and log buffer isolate discovery state; unchanged built fixture bytes are shared. Cleanup establishes its source completion barrier before removal and retains unresolved inputs instead of claiming closure.
// @evidence contracts/e2e.md#preserved-coverage Original fix discovery, other action, zero-action assertion and exact unowned-command log remain here; missing-command and owned-command neighbors retain separate observations, without inferring command execution.
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

//go:embed testdata/native-plugin-source/unowned-command.go.txt
var nativePluginSourceUnownedCommandSidecar string
