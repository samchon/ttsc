//go:build e2e

package driver_test

import (
  _ "embed"
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
// @evidence contracts/testing.md#execution-ownership Go test/driver discovers and executes the built static child command through NativePluginSource, observing the decoded-result refusal without an editor or installed CLI.
// @evidence contracts/e2e.md#necessary-boundary The actual command response carries documentChanges across the child connection into native WorkspaceEdit admission; the named error distinguishes it from a silent empty successful response.
// @evidence contracts/e2e.md#shared-execution This unchanged documentChanges fixture is another entry in the existing lazy dispatcher build, without a separate compilation for this rejected shape.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private source and cwd isolate discovery and command state; unchanged fixture bytes are shared. The source completion barrier precedes normal removal, while unresolved cleanup retains inputs and fails rather than assuming release.
// @evidence contracts/e2e.md#preserved-coverage Original command ownership, documentChanges input and error naming WorkspaceEdit.documentChanges remain here; valid changes-only responses are separate cases, and editor application is not observed.
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

//go:embed testdata/native-plugin-source/document-changes.go.txt
var nativePluginSourceDocumentChangesSidecar string
