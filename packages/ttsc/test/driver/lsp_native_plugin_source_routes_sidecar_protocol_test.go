//go:build e2e

package driver_test

import (
  "bytes"
  _ "embed"
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceRoutesSidecarProtocol verifies native LSP plugin
// source discovery, diagnostics, code actions and command execution through
// the sidecar protocol, without claiming every optional source operation.
//
// The VSCode path depends on a launcher-produced manifest whose sidecar
// binaries answer diagnostics, code actions, and executeCommand requests. This
// test keeps tsgo out of the loop and pins the bridge contract directly:
// command ownership discovery, compact --plugins-json forwarding, and
// WorkspaceEdit unmarshalling.
//
// 1. Build a tiny fake sidecar binary in a temp directory.
// 2. Construct NativePluginSource from a manifest containing that binary.
// 3. Call CommandIDs, Diagnostics, CodeActions, and ExecuteCommand.
// 4. Assert returned LSP shapes and forwarded flags match the manifest.
//
// @evidence contracts/testing.md#behavioral-verification NativePluginSource discovers command IDs/kinds, returns document and project diagnostic records, returns a command action and decodes its changes edit; the actual call log contains the listed verbs and physical config/project-context/plugin fragments.
// @evidence contracts/testing.md#independent-expectations Authored protocol payloads, manifest inputs and literal edit text define independent transport expectations. Log fragment checks establish presence rather than exact argv equality.
// @evidence contracts/testing.md#distinguishing-cases One fixture checks discovery plus diagnostics, code actions and executeCommand, including logical versus physical project config and returned project diagnostics; malformed response and ownership cases are separate.
// @evidence contracts/testing.md#execution-ownership Go test/driver crosses real NativePluginSource child verbs using a built static fixture, then checks decoded records and a native call log; no editor publication, installed CLI or tsgo session runs.
// @evidence contracts/e2e.md#necessary-boundary Discovery, read and command responses plus actual forwarded config/context/plugin argv cross a selected child connection; direct DTO or predicate calls would not establish those transport relationships.
// @evidence contracts/e2e.md#shared-execution The static routing fixture is one entry of the existing lazy dispatcher build shared with the other native source cases; no distinct build is requested for these verbs.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its source, cwd and log file and uses t.Setenv for the call-log setting. Its restoration is registered after fixture cleanup and therefore runs first; cleanup's refresh may use the restored environment, so these assertions certify only the log read during the case. The source completion barrier precedes normal cwd/log removal, unresolved completion retains them, and shared dispatcher bytes remain unchanged.
// @evidence contracts/e2e.md#preserved-coverage Original manifest, logical/physical context, command/kind, diagnostic, action, edit, log-fragment and no-error assertions remain here, with explicit plugins-json flag presence added; exact argv serialization and editor application are not inferred.
func TestLSPNativePluginSourceRoutesSidecarProtocol(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildFakeLSPSidecar(t)
  logPath := filepath.Join(dir, "calls.log")
  t.Setenv("TTSC_FAKE_PLUGIN_LOG", logPath)
  physicalConfig := filepath.Join(dir, "physical-tsconfig.json")
  projectContext, err := json.Marshal(map[string]string{
    "invocationCwd":       filepath.Join(dir, "logical"),
    "logicalConfigPath":   filepath.Join(dir, "logical", "tsconfig.json"),
    "logicalProjectRoot":  filepath.Join(dir, "logical"),
    "physicalConfigPath":  physicalConfig,
    "physicalProjectRoot": dir,
  })
  if err != nil {
    t.Fatal(err)
  }

  manifest, err := json.Marshal(driver.NativePluginManifest{
    Plugins: []driver.NativePluginConfigEntry{{
      Config: map[string]any{"mode": "strict"},
      Name:   "@ttsc/fake",
      Stage:  "check",
    }},
    LSPPlugins: []driver.NativeLSPPluginEntry{{
      Binary:             sidecar,
      Name:               "@ttsc/fake",
      ProjectContextArgs: true,
      Stage:              "check",
    }},
    ProjectContext: projectContext,
  })
  if err != nil {
    t.Fatal(err)
  }

  var errBuf bytes.Buffer
  source, err := driver.NewNativePluginSource(driver.NativePluginSourceOptions{
    Cwd:          dir,
    Err:          &errBuf,
    ManifestJSON: string(manifest),
    Tsconfig:     "logical-tsconfig.json",
  })
  if err != nil {
    t.Fatalf("NewNativePluginSource failed: %v", err)
  }
  fixture.source = source
  if got := source.CommandIDs(); len(got) != 1 || got[0] != "ttsc.fake.fix" {
    t.Fatalf("CommandIDs: want [ttsc.fake.fix], got %#v", got)
  }
  if got := source.CodeActionKinds(); len(got) != 1 || got[0] != "source.fixAll.ttsc" {
    t.Fatalf("CodeActionKinds: want [source.fixAll.ttsc], got %#v", got)
  }

  diagnostics := source.Diagnostics(driver.LSPDocumentVersion{URI: "file:///tmp/main.ts"})
  if len(diagnostics.Document) != 1 || diagnostics.Document[0].Source != "ttsc/fake" || diagnostics.Document[0].Code != "fake-rule" {
    t.Fatalf("Diagnostics returned unexpected payload: %#v", diagnostics)
  }
  if diagnostics.Project == nil || diagnostics.Project.URI != "file:///logical/tsconfig.json" || len(diagnostics.Project.Diagnostics) != 1 {
    t.Fatalf("Diagnostics dropped project publication: %#v", diagnostics)
  }

  actions := source.CodeActions(
    "file:///tmp/main.ts",
    driver.LSPRange{Start: driver.LSPPosition{Line: 0}, End: driver.LSPPosition{Line: 0, Character: 3}},
    driver.LSPCodeActionContext{},
  )
  if len(actions) != 1 || actions[0].Command == nil || actions[0].Command.Command != "ttsc.fake.fix" {
    t.Fatalf("CodeActions returned unexpected payload: %#v", actions)
  }

  edit, err := source.ExecuteCommand("ttsc.fake.fix", []json.RawMessage{json.RawMessage(`"file:///tmp/main.ts"`)})
  if err != nil {
    t.Fatalf("ExecuteCommand failed: %v", err)
  }
  edits := edit.Changes["file:///tmp/main.ts"]
  if len(edits) != 1 || edits[0].NewText != "let" {
    t.Fatalf("ExecuteCommand edit: %#v", edit)
  }

  calls, err := os.ReadFile(logPath)
  if err != nil {
    t.Fatal(err)
  }
  log := string(calls)
  for _, want := range []string{
    "lsp-command-ids",
    "lsp-code-action-kinds",
    "lsp-diagnostics",
    "lsp-code-actions",
    "lsp-execute-command",
    "--cwd=" + dir,
    "--tsconfig=" + physicalConfig,
    "--project-context-json=",
    "--plugins-json=",
    `"logicalConfigPath"`,
    `"mode":"strict"`,
  } {
    if !strings.Contains(log, want) {
      t.Fatalf("sidecar log missing %q:\n%s", want, log)
    }
  }
  if errBuf.Len() != 0 {
    t.Fatalf("unexpected bridge stderr: %s", errBuf.String())
  }
}

func buildFakeLSPSidecar(t *testing.T) string {
  t.Helper()
  return buildNativePluginSourceTestSidecar(t, fakeLSPSidecarSource)
}

//go:embed testdata/native-plugin-source/routes-protocol.go.txt
var fakeLSPSidecarSource string
