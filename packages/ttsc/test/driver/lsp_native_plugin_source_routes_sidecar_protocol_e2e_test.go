//go:build e2e

package driver_test

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceRoutesSidecarProtocol verifies native LSP plugin
// source delegates every PluginSource method to the sidecar protocol.
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
// @evidence contracts/testing.md#behavioral-verification NativePluginSource discovers command IDs/kinds, publishes document and project diagnostics, returns a command action and decodes its changes edit; the actual call log contains all verbs and physical config/project-context/plugin flags.
// @evidence contracts/testing.md#independent-expectations Authored protocol payloads, manifest inputs and literal edit text define independent transport expectations. Log fragment checks establish presence rather than exact argv equality.
// @evidence contracts/testing.md#distinguishing-cases One fixture checks discovery plus diagnostics, code actions and executeCommand, including logical versus physical project config and project publication; malformed response and ownership cases are separate.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceRoutesSidecarProtocol is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary NativePluginSource discovers and invokes actual fixture executables across argv/stdin/stdout/stderr and JSON; direct payload validation cannot establish process transport, framing or failed-exit capture for this response.
// @evidence contracts/e2e.md#shared-execution buildNativePluginSourceTestSidecar links all twelve authored fixture programs in one standard-library dispatcher build. Equal content-presence cases reuse the same fixture program; executable names select different payload producers. Discovery and operation each use separate synchronous child processes because the product sidecar protocol accepts one verb per process, and no per-case Go build remains.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each source and fixture cwd belong to this case. Its fixture owner installs an observer during cleanup and requests a completion refresh; the callback runs after native hint calls finish, closes the source and signals completion before fixture deletion. Close drops queued work and joins resident children; no full scheduler-goroutine join is claimed. A thirty-second wait reports failure and cancels the source, then a ten-second wait still requires the callback barrier. An unresolved barrier retains both the fixture and shared producer directory and fails the suite. The call-log environment is restored through t.Setenv. No cache invalidation is claimed.
// @evidence contracts/e2e.md#preserved-coverage This body retains its reviewed payload, command, edit, diagnostic, size or stream assertions and failure identity. The shared producer preserves each authored fixture verb body and deliberate failure; no assertion is replaced by metadata inspection and no portable assertion transfer is claimed.
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

const fakeLSPSidecarSource = `package main

import (
  "fmt"
  "os"
  "strings"
)

func main() {
  logPath := os.Getenv("TTSC_FAKE_PLUGIN_LOG")
  if logPath != "" {
    if f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err == nil {
      _, _ = f.WriteString(strings.Join(os.Args[1:], " ")+"\n")
      _ = f.Close()
    }
  }
  if len(os.Args) < 2 {
    os.Exit(2)
  }
  switch os.Args[1] {
  case "lsp-command-ids":
    fmt.Println(` + "`" + `["ttsc.fake.fix"]` + "`" + `)
  case "lsp-code-action-kinds":
    fmt.Println(` + "`" + `["source.fixAll.ttsc"]` + "`" + `)
  case "lsp-diagnostics":
    fmt.Println(` + "`" + `{"document":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":3}},"severity":1,"code":"fake-rule","source":"ttsc/fake","message":"fake diagnostic"}],"project":{"uri":"file:///logical/tsconfig.json","diagnostics":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"severity":1,"code":"fake-project","source":"ttsc/fake","message":"fake project diagnostic"}]}}` + "`" + `)
  case "lsp-code-actions":
    fmt.Println(` + "`" + `[{"title":"Fake fix","kind":"source.fixAll.ttsc","command":{"title":"Fake fix","command":"ttsc.fake.fix","arguments":["file:///tmp/main.ts"]}}]` + "`" + `)
  case "lsp-execute-command":
    fmt.Println(` + "`" + `{"changes":{"file:///tmp/main.ts":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":3}},"newText":"let"}]}}` + "`" + `)
  default:
    os.Exit(2)
  }
}
`
