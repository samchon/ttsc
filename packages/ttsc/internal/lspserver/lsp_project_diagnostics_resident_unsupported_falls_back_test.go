package lspserver

import (
  "bytes"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

// TestLSPProjectDiagnosticsResidentUnsupportedFallsBack verifies a staged
// sidecar can serve its advertised direct command through an older daemon.
//
// `lsp-serve` and its accepted request verbs can ship at different times. Once
// a resident answers another verb, rejecting `lsp-project-diagnostics` is not a
// transport failure and used to suppress the working one-shot command.
//
//  1. Build a sidecar whose daemon rejects only project diagnostics.
//  2. Advertise the direct project-diagnostic capability.
//  3. Request a publication and assert the one-shot command answers it.
//  4. Assert both resident rejection and direct fallback occurred once.
func TestLSPProjectDiagnosticsResidentUnsupportedFallsBack(t *testing.T) {
  dir := t.TempDir()
  sidecarSource := filepath.Join(dir, "sidecar.go")
  if err := os.WriteFile(
    sidecarSource,
    []byte(projectDiagnosticsFallbackSidecarSource),
    0644,
  ); err != nil {
    t.Fatal(err)
  }
  binary := filepath.Join(dir, "sidecar")
  if runtime.GOOS == "windows" {
    binary += ".exe"
  }
  build := exec.Command("go", "build", "-o", binary, sidecarSource)
  if output, err := build.CombinedOutput(); err != nil {
    t.Fatalf("go build sidecar failed: %v\n%s", err, output)
  }
  logPath := filepath.Join(dir, "calls.log")
  t.Setenv("TTSC_PROJECT_DIAGNOSTICS_FALLBACK_LOG", logPath)
  plugin := NativeLSPPluginEntry{
    Binary:             binary,
    Name:               "@ttsc/staged",
    ProjectDiagnostics: true,
  }
  source := &NativePluginSource{
    cwd:         dir,
    err:         &bytes.Buffer{},
    plugins:     []NativeLSPPluginEntry{plugin},
    pluginsJSON: "[]",
    tsconfig:    filepath.Join(dir, "tsconfig.json"),
  }
  t.Cleanup(source.shutdownResidents)

  got := source.ProjectDiagnostics()

  if got == nil || got.URI != "file:///project/tsconfig.json" ||
    len(got.Diagnostics) != 1 ||
    got.Diagnostics[0].Code != "direct" {
    t.Fatalf("direct fallback publication = %#v", got)
  }
  calls, err := os.ReadFile(logPath)
  if err != nil {
    t.Fatal(err)
  }
  log := string(calls)
  if strings.Count(log, "resident lsp-project-diagnostics") != 1 {
    t.Fatalf("resident attempt count is wrong:\n%s", log)
  }
  if strings.Count(log, "direct lsp-project-diagnostics") != 1 {
    t.Fatalf("direct fallback count is wrong:\n%s", log)
  }
}

const projectDiagnosticsFallbackSidecarSource = `package main

import (
  "bufio"
  "encoding/json"
  "fmt"
  "os"
)

type request struct {
  Verb string ` + "`json:\"verb\"`" + `
}

func logCall(message string) {
  path := os.Getenv("TTSC_PROJECT_DIAGNOSTICS_FALLBACK_LOG")
  file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
  if err == nil {
    _, _ = fmt.Fprintln(file, message)
    _ = file.Close()
  }
}

func main() {
  if len(os.Args) < 2 {
    os.Exit(2)
  }
  if os.Args[1] == "lsp-serve" {
    scanner := bufio.NewScanner(os.Stdin)
    for scanner.Scan() {
      var req request
      if json.Unmarshal(scanner.Bytes(), &req) != nil {
        os.Exit(2)
      }
      logCall("resident " + req.Verb)
      fmt.Println(` + "`" + `{"result":null,"code":2}` + "`" + `)
    }
    return
  }
  if os.Args[1] == "lsp-project-diagnostics" {
    logCall("direct lsp-project-diagnostics")
    fmt.Println(` + "`" + `{"uri":"file:///project/tsconfig.json","diagnostics":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"code":"direct","message":"direct"}]}` + "`" + `)
    return
  }
  os.Exit(2)
}
`
