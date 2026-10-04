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

// TestLSPNativePluginSourceIgnoresDuplicateCommandID verifies the first
// command owner wins.
//
// `workspace/executeCommand` routing is single-owner. If two sidecars advertise
// the same command id, routing to the later one would make earlier code actions
// unpredictable, so duplicate ids are logged and ignored during discovery.
//
// 1. Build two fake sidecars that both advertise `ttsc.fake.fix`.
// 2. Construct NativePluginSource with both entries.
// 3. Execute the command.
// 4. Assert the first sidecar handles it and the duplicate is logged.
//
// @evidence contracts/testing.md#behavioral-verification Two fixture entries advertise ttsc.fake.fix; ExecuteCommand returns the first fixture edit and logs duplicate ownership.
// @evidence contracts/testing.md#independent-expectations Command discovery is first-owner routing by the documented sidecar contract; first and second literal edit values provide independent oracles.
// @evidence contracts/testing.md#distinguishing-cases Two owners are necessary to distinguish ordering; separate fixture programs remain in the same compiled batch and independent command processes.
// @evidence contracts/testing.md#execution-ownership Go test/driver discovers commands from two built static sidecar entries and executes the selected owner's native command, checking its decoded edit and duplicate log; this is a native protocol boundary without an editor process.
// @evidence contracts/e2e.md#necessary-boundary Discovery of the same ID from two actual child entries must route later execution to the first; distinct first/second edit literals detect wrong-child selection across the protocol connection.
// @evidence contracts/e2e.md#shared-execution Both unchanged fixture programs are entries of one lazy dispatcher build. Distinct executable names select their different response bodies without independent compilation.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity One case-owned source captures the ordered two-entry manifest, private cwd and log buffer. Shared binary bytes are immutable inputs; cleanup waits for source completion before removal and retains unresolved inputs rather than certifying child closure.
// @evidence contracts/e2e.md#preserved-coverage Both duplicate advertisements, original manifest order, exact first edit and duplicate-ID log remain here; no editor application of the edit or arbitrary process total is inferred.
func TestLSPNativePluginSourceIgnoresDuplicateCommandID(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  first := buildNativePluginSourceTestSidecar(t, nativePluginSourceDuplicateCommandFirstSidecar)
  second := buildNativePluginSourceTestSidecar(t, nativePluginSourceDuplicateCommandSecondSidecar)
  manifest, err := json.Marshal(driver.NativePluginManifest{
    LSPPlugins: []driver.NativeLSPPluginEntry{
      {Binary: first, Name: "@ttsc/first"},
      {Binary: second, Name: "@ttsc/second"},
    },
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
  edit, err := source.ExecuteCommand("ttsc.fake.fix", nil)
  if err != nil {
    t.Fatalf("ExecuteCommand failed: %v", err)
  }
  if got := edit.Changes["file:///tmp/a.ts"][0].NewText; got != "first" {
    t.Fatalf("expected first sidecar to own command, got edit %q", got)
  }
  if !strings.Contains(errBuf.String(), `duplicate LSP command id "ttsc.fake.fix"`) {
    t.Fatalf("missing duplicate-command log:\n%s", errBuf.String())
  }
}

//go:embed testdata/native-plugin-source/duplicate-first.go.txt
var nativePluginSourceDuplicateCommandFirstSidecar string

//go:embed testdata/native-plugin-source/duplicate-second.go.txt
var nativePluginSourceDuplicateCommandSecondSidecar string
