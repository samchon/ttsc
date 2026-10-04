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

// TestLSPNativePluginSourceDropsCommandlessCodeAction checks that a title-only
// native action is dropped and logged before returning from CodeActions.
// It does not execute editor forwarding or codeAction/resolve.
//
// The current ttscserver LSP protocol supports command-backed actions only and
// does not implement codeAction/resolve. A sidecar action without a command or
// supported edit cannot do anything useful in the editor.
//
// 1. Build a fake sidecar that returns a title-only code action.
// 2. Ask NativePluginSource for code actions.
// 3. Assert the action is dropped and logged.
//
// @evidence contracts/testing.md#behavioral-verification CodeActions drops a title-only action and logs commandless LSP action.
// @evidence contracts/testing.md#independent-expectations The supported sidecar protocol requires a command-backed action and has no codeAction/resolve path.
// @evidence contracts/testing.md#distinguishing-cases A commandless payload differs from owned-command, unowned-command and direct-edit payloads.
// @evidence contracts/testing.md#execution-ownership Go test/driver calls NativePluginSource against a built static sidecar through native argv and JSON output, then checks the returned actions and log; this is a native protocol boundary without an installed editor or CLI.
// @evidence contracts/e2e.md#necessary-boundary The child emits a title-only action through the native code-actions verb; actual decoding and command requirement produce the empty result and specific refusal log, which a predicate-only call would not observe.
// @evidence contracts/e2e.md#shared-execution The existing lazy dispatcher build includes this unchanged commandless fixture with the other sidecar inputs, without a case-specific native build.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its cwd, source and log buffer. Shared dispatcher bytes do not depend on mutable case state; source completion precedes normal fixture reclamation, while unresolved completion retains inputs and fails.
// @evidence contracts/e2e.md#preserved-coverage The original title-only input, zero returned actions and commandless refusal message remain at this connection; owned, unowned and direct-edit neighbors keep their separate assertions.
func TestLSPNativePluginSourceDropsCommandlessCodeAction(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceCommandlessActionSidecar)
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
    t.Fatalf("commandless action was not dropped: %#v", actions)
  }
  if !strings.Contains(errBuf.String(), "returned commandless LSP action") {
    t.Fatalf("missing commandless-action log:\n%s", errBuf.String())
  }
}

//go:embed testdata/native-plugin-source/commandless-action.go.txt
var nativePluginSourceCommandlessActionSidecar string
