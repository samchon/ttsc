package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourceTruncatesFailureStderr verifies sidecar stderr is
// bounded on failed LSP verbs.
//
// Plugin processes are editor-facing in `ttscserver`; a broken sidecar should
// not be able to make the server retain arbitrary stderr while formatting the
// error log. The bridge caps stderr and marks the message as truncated.
//
// 1. Build a fake sidecar with valid discovery verbs.
// 2. Have `lsp-code-actions` write large stderr and exit non-zero.
// 3. Assert no actions are returned and the log is truncated.
func TestLSPNativePluginSourceTruncatesFailureStderr(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceOversizedStderrSidecar)
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
  if actions := source.CodeActions("file:///tmp/a.ts", driver.LSPRange{}, driver.LSPCodeActionContext{}); len(actions) != 0 {
    t.Fatalf("stderr-failing sidecar returned actions: %#v", actions)
  }
  log := errBuf.String()
  if !strings.Contains(log, "stderr truncated") {
    t.Fatalf("missing stderr truncation marker:\n%s", log)
  }
  if len(log) > 1024*1024+4096 {
    t.Fatalf("stderr log was not bounded: %d bytes", len(log))
  }
}

const nativePluginSourceOversizedStderrSidecar = `package main

import (
  "fmt"
  "os"
  "strings"
)

func main() {
  if len(os.Args) < 2 {
    os.Exit(2)
  }
  switch os.Args[1] {
  case "lsp-command-ids":
    fmt.Println(` + "`" + `["ttsc.fake.fix"]` + "`" + `)
  case "lsp-code-action-kinds":
    fmt.Println(` + "`" + `["source.fixAll.ttsc"]` + "`" + `)
  case "lsp-code-actions":
    fmt.Fprint(os.Stderr, strings.Repeat("x", 2*1024*1024))
    os.Exit(1)
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
