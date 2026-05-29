package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourcePipesContentStdin verifies that
// ExecuteCommandWithContent passes the buffer text to the sidecar on stdin and
// appends the --content-stdin flag. The fake sidecar reads stdin to EOF, checks
// the flag is present, and echoes the received text back inside the
// WorkspaceEdit's newText so the test can prove the bytes reached the sidecar.
//
// 1. Build a fake sidecar that owns ttsc.format.document and reflects stdin.
// 2. Call ExecuteCommandWithContent with buffer text.
// 3. Assert the returned edit's newText equals the piped buffer text.
func TestLSPNativePluginSourcePipesContentStdin(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceContentStdinSidecar)
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

  uri := "file:///tmp/a.ts"
  arg, _ := json.Marshal(uri)
  edit, err := source.ExecuteCommandWithContent("ttsc.format.document", []json.RawMessage{arg}, "const buffered = 1;", true)
  if err != nil {
    t.Fatalf("ExecuteCommandWithContent failed: %v", err)
  }
  if edit == nil {
    t.Fatal("expected a WorkspaceEdit, got nil")
  }
  edits := edit.Changes[uri]
  if len(edits) != 1 {
    t.Fatalf("expected one edit for %q, got %#v", uri, edit.Changes)
  }
  if edits[0].NewText != "FLAG:const buffered = 1;" {
    t.Fatalf("sidecar did not receive piped stdin with --content-stdin flag: %q", edits[0].NewText)
  }
}

// TestLSPNativePluginSourceOmitsContentStdinWhenEmpty verifies the existing
// disk-formatting path is unchanged: with empty content the source must not
// append --content-stdin nor pipe stdin, so the sidecar reports the flag absent.
func TestLSPNativePluginSourceOmitsContentStdinWhenEmpty(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceContentStdinSidecar)
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

  uri := "file:///tmp/a.ts"
  arg, _ := json.Marshal(uri)
  edit, err := source.ExecuteCommand("ttsc.format.document", []json.RawMessage{arg})
  if err != nil {
    t.Fatalf("ExecuteCommand failed: %v", err)
  }
  if edit == nil || len(edit.Changes[uri]) != 1 {
    t.Fatalf("expected one edit, got %#v", edit)
  }
  if edit.Changes[uri][0].NewText != "NOFLAG:" {
    t.Fatalf("expected no --content-stdin flag and no stdin, got %q", edit.Changes[uri][0].NewText)
  }
}

// TestLSPNativePluginSourcePipesEmptyContentStdin pins the empty-buffer gate.
// When hasContent is true the source must append --content-stdin and pipe stdin
// even though content is "", so an emptied editor buffer formats in-memory
// instead of falling through to stale disk content. The sidecar reports the flag
// present and echoes the (empty) stdin back.
func TestLSPNativePluginSourcePipesEmptyContentStdin(t *testing.T) {
  dir := t.TempDir()
  sidecar := buildNativePluginSourceTestSidecar(t, dir, nativePluginSourceContentStdinSidecar)
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

  uri := "file:///tmp/a.ts"
  arg, _ := json.Marshal(uri)
  edit, err := source.ExecuteCommandWithContent("ttsc.format.document", []json.RawMessage{arg}, "", true)
  if err != nil {
    t.Fatalf("ExecuteCommandWithContent failed: %v", err)
  }
  if edit == nil || len(edit.Changes[uri]) != 1 {
    t.Fatalf("expected one edit, got %#v", edit)
  }
  if edit.Changes[uri][0].NewText != "FLAG:" {
    t.Fatalf("hasContent=true with empty content must still pass --content-stdin and pipe empty stdin, got %q", edit.Changes[uri][0].NewText)
  }
}

const nativePluginSourceContentStdinSidecar = `package main

import (
  "encoding/json"
  "fmt"
  "io"
  "os"
)

func main() {
  if len(os.Args) < 2 {
    os.Exit(2)
  }
  switch os.Args[1] {
  case "lsp-command-ids":
    fmt.Println(` + "`" + `["ttsc.format.document"]` + "`" + `)
  case "lsp-code-action-kinds":
    fmt.Println(` + "`" + `[]` + "`" + `)
  case "lsp-execute-command":
    hasFlag := false
    for _, a := range os.Args {
      if a == "--content-stdin" {
        hasFlag = true
      }
    }
    stdin := ""
    if hasFlag {
      data, _ := io.ReadAll(os.Stdin)
      stdin = string(data)
    }
    prefix := "NOFLAG:"
    if hasFlag {
      prefix = "FLAG:"
    }
    edit := map[string]any{
      "changes": map[string]any{
        "file:///tmp/a.ts": []any{
          map[string]any{
            "range": map[string]any{
              "start": map[string]any{"line": 0, "character": 0},
              "end":   map[string]any{"line": 0, "character": 0},
            },
            "newText": prefix + stdin,
          },
        },
      },
    }
    out, _ := json.Marshal(edit)
    fmt.Println(string(out))
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
