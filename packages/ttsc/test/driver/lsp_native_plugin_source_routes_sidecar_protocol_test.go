package driver_test

import (
  "bytes"
  "encoding/json"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
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
func TestLSPNativePluginSourceRoutesSidecarProtocol(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildFakeLSPSidecar(t, dir)
  logPath := filepath.Join(dir, "calls.log")
  t.Setenv("TTSC_FAKE_PLUGIN_LOG", logPath)

  manifest, err := json.Marshal(driver.NativePluginManifest{
    Plugins: []driver.NativePluginConfigEntry{{
      Config: map[string]any{"mode": "strict"},
      Name:   "@ttsc/fake",
      Stage:  "check",
    }},
    LSPPlugins: []driver.NativeLSPPluginEntry{{
      Binary: sidecar,
      Name:   "@ttsc/fake",
      Stage:  "check",
    }},
  })
  if err != nil {
    t.Fatal(err)
  }

  var errBuf bytes.Buffer
  source, err := driver.NewNativePluginSource(driver.NativePluginSourceOptions{
    Cwd:          dir,
    Err:          &errBuf,
    ManifestJSON: string(manifest),
    Tsconfig:     "tsconfig.app.json",
  })
  if err != nil {
    t.Fatalf("NewNativePluginSource failed: %v", err)
  }
  if got := source.CommandIDs(); len(got) != 1 || got[0] != "ttsc.fake.fix" {
    t.Fatalf("CommandIDs: want [ttsc.fake.fix], got %#v", got)
  }
  if got := source.CodeActionKinds(); len(got) != 1 || got[0] != "source.fixAll.ttsc" {
    t.Fatalf("CodeActionKinds: want [source.fixAll.ttsc], got %#v", got)
  }

  diagnostics := source.Diagnostics(driver.LSPDocumentVersion{URI: "file:///tmp/main.ts"})
  if len(diagnostics) != 1 || diagnostics[0].Source != "ttsc/fake" || diagnostics[0].Code != "fake-rule" {
    t.Fatalf("Diagnostics returned unexpected payload: %#v", diagnostics)
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
    "--tsconfig=tsconfig.app.json",
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

func buildFakeLSPSidecar(t *testing.T, dir string) string {
  t.Helper()
  source := filepath.Join(dir, "fake_sidecar.go")
  if err := os.WriteFile(source, []byte(fakeLSPSidecarSource), 0644); err != nil {
    t.Fatal(err)
  }
  binary := filepath.Join(dir, "fake-sidecar")
  if runtime.GOOS == "windows" {
    binary += ".exe"
  }
  cmd := exec.Command("go", "build", "-o", binary, source)
  if out, err := cmd.CombinedOutput(); err != nil {
    t.Fatalf("go build fake sidecar failed: %v\n%s", err, out)
  }
  return binary
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
    fmt.Println(` + "`" + `[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":3}},"severity":1,"code":"fake-rule","source":"ttsc/fake","message":"fake diagnostic"}]` + "`" + `)
  case "lsp-code-actions":
    fmt.Println(` + "`" + `[{"title":"Fake fix","kind":"source.fixAll.ttsc","command":{"title":"Fake fix","command":"ttsc.fake.fix","arguments":["file:///tmp/main.ts"]}}]` + "`" + `)
  case "lsp-execute-command":
    fmt.Println(` + "`" + `{"changes":{"file:///tmp/main.ts":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":3}},"newText":"let"}]}}` + "`" + `)
  default:
    os.Exit(2)
  }
}
`
