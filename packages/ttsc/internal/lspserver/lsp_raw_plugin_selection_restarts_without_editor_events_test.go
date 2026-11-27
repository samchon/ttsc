package lspserver

import (
  "bytes"
  "context"
  "encoding/base64"
  "encoding/json"
  "errors"
  "io"
  "os"
  "path/filepath"
  "runtime"
  "syscall"
  "testing"
  "time"
)

// TestLSPRawPluginSelectionRestartsWithoutEditorEvents verifies that changes
// at POSIX byte paths end the proxy session without an editor watcher event.
// Editors may be unable to represent those paths.
//
//  1. Load a selection for a raw link or an aliased source directory.
//  2. Initialize the proxy and retarget the link, modify a source file, or add a
//     source file.
//  3. Check the client notification and the session's restart verdict.
//
// @evidence contracts/testing.md#behavioral-verification Native link retargeting, source content and source membership each drive the periodic check, restart sentinel and client notification through Run.
// @evidence contracts/testing.md#independent-expectations Equal-content files isolate retargeting. Independent source mutations change either one recorded file or the directory population. Each case expects the restart sentinel and literal notification payload. The production digest helper supplies the baseline.
// @evidence contracts/testing.md#distinguishing-cases Unchanged inputs are current. A source directory is declared through a UTF-8 alias and uses no raw descriptor entries, so the source cases require normalization and polling of the directory group itself. Windows and filesystems that reject the byte fixtures with EILSEQ skip the relevant cases.
// @evidence contracts/testing.md#execution-ownership The Go unit owns its temporary files, proxy pipes and source. Pipe cleanup unblocks pumps on failure. No real editor or sidecar is required.
func TestLSPRawPluginSelectionRestartsWithoutEditorEvents(t *testing.T) {
  if runtime.GOOS == "windows" {
    t.Skip("requires POSIX byte paths")
  }
  t.Run("same-content link retarget", func(t *testing.T) {
    root := t.TempDir()
    first := filepath.Join(root, "first.js")
    second := filepath.Join(root, "second.js")
    for _, file := range []string{first, second} {
      if err := os.WriteFile(file, []byte("module.exports = {};"), 0o644); err != nil {
        t.Fatal(err)
      }
    }
    middle := filepath.Join(root, "middle-\xff")
    if err := os.Symlink(first, middle); err != nil {
      if errors.Is(err, syscall.EILSEQ) {
        t.Skip("filesystem refused a non-UTF-8 filename")
      }
      t.Fatal(err)
    }
    selection := NativePluginSelectionInputs{
      RawDescriptorFiles: map[string]string{
        base64.StdEncoding.EncodeToString([]byte(middle)): projectInputReloadFileDigest(middle),
      },
    }
    assertLSPRawPluginSelectionRestart(t, root, selection, func() {
      if err := os.Remove(middle); err != nil {
        t.Fatal(err)
      }
      if err := os.Symlink(second, middle); err != nil {
        t.Fatal(err)
      }
    })
  })

  for _, change := range []struct {
    name string
    file string
  }{
    {"source content", "compiler.go"},
    {"source membership", "added.go"},
  } {
    t.Run(change.name, func(t *testing.T) {
      root := t.TempDir()
      physical := filepath.Join(root, "compiler-\xff")
      if err := os.Mkdir(physical, 0o755); err != nil {
        if errors.Is(err, syscall.EILSEQ) {
          t.Skip("filesystem refused a non-UTF-8 directory")
        }
        t.Fatal(err)
      }
      alias := filepath.Join(root, "compiler")
      if err := os.Symlink(physical, alias); err != nil {
        t.Fatal(err)
      }
      file := filepath.Join(alias, "compiler.go")
      if err := os.WriteFile(file, []byte("package original\n"), 0o644); err != nil {
        t.Fatal(err)
      }
      selection := NativePluginSelectionInputs{
        SourceFiles: map[string]map[string]string{
          alias: {"compiler.go": projectInputReloadFileDigest(file)},
        },
      }
      assertLSPRawPluginSelectionRestart(t, root, selection, func() {
        if err := os.WriteFile(filepath.Join(physical, change.file), []byte("package changed\n"), 0o644); err != nil {
          t.Fatal(err)
        }
      })
    })
  }
}

// assertLSPRawPluginSelectionRestart checks the restart after initialization
// without registering editor watchers or sending a watched-files event.
func assertLSPRawPluginSelectionRestart(
  t *testing.T,
  root string,
  selection NativePluginSelectionInputs,
  change func(),
) {
  t.Helper()
  manifest, err := json.Marshal(NativePluginManifest{SelectionInputs: &selection})
  if err != nil {
    t.Fatal(err)
  }
  source, err := NewNativePluginSource(NativePluginSourceOptions{Cwd: root, ManifestJSON: string(manifest)})
  if err != nil {
    t.Fatal(err)
  }
  t.Cleanup(source.shutdownResidents)
  if !source.ProjectInputReloadFingerprintsAreCurrent() || len(source.ProjectInputs().WatchDirectories) != 0 {
    t.Fatal("the unchanged byte path should be current and stay out of editor registrations")
  }

  editorIn, editorWrite := io.Pipe()
  upstreamOut, upstreamWrite := io.Pipe()
  t.Cleanup(func() {
    editorIn.Close()
    editorWrite.Close()
    upstreamOut.Close()
    upstreamWrite.Close()
  })
  var editorOut bytes.Buffer
  proxy := NewProxy(ProxyOptions{
    EditorIn:    editorIn,
    EditorOut:   &editorOut,
    UpstreamIn:  io.Discard,
    UpstreamOut: upstreamOut,
    Source:      source,
  })
  done := make(chan error, 1)
  go func() { done <- proxy.Run(context.Background()) }()
  if err := WriteFrame(editorWrite, []byte(`{"jsonrpc":"2.0","method":"initialized","params":{}}`)); err != nil {
    t.Fatal(err)
  }
  change()
  select {
  case err := <-done:
    if !errors.Is(err, ErrLSPPluginSelectionChanged) {
      t.Fatalf("proxy result = %v, want plugin selection restart", err)
    }
  case <-time.After(5 * time.Second):
    t.Fatal("the proxy did not restart after a change at a non-UTF-8 path")
  }
  _, body, err := NewFrameReader(&editorOut).Read()
  if err != nil {
    t.Fatal(err)
  }
  env, err := ParseEnvelope(body)
  if err != nil || env.Method != "ttsc/pluginSelectionChanged" || string(env.Params) != `{"reason":"projectInputChanged"}` {
    t.Fatalf("unexpected restart notification %q: %v", body, err)
  }
}
