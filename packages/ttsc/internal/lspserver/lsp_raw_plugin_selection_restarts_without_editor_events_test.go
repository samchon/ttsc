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

// TestLSPRawPluginSelectionRestartsWithoutEditorEvents verifies that a
// same-content retarget of a POSIX byte path ends the proxy session without an
// editor watcher event. Editors may not represent the native link name.
//
//  1. Load a selection with a raw link and verify its currentness.
//  2. Initialize the proxy and retarget the link to a file with the same content.
//  3. Check the client notification and the session's restart verdict.
//
// @evidence contracts/testing.md#behavioral-verification Real native link retargeting drives the proxy's periodic check, restart sentinel, and client notification through the Run entry point.
// @evidence contracts/testing.md#independent-expectations Two independently written equal-content files isolate the target change. The test expects the restart sentinel and literal notification payload. The baseline uses the host digest helper, so this does not independently verify hash framing.
// @evidence contracts/testing.md#distinguishing-cases The adopted unchanged fingerprint is current, and the same-content retarget changes selection with no client frames after initialization. Windows cannot supply the POSIX byte fixture, and a native EILSEQ refusal skips the mutation where that filename cannot be created.
// @evidence contracts/testing.md#execution-ownership The Go unit owns its temporary files, proxy pipes and source. Pipe cleanup unblocks pumps on failure. No real editor or sidecar is required.
func TestLSPRawPluginSelectionRestartsWithoutEditorEvents(t *testing.T) {
  if runtime.GOOS == "windows" {
    t.Skip("requires POSIX byte paths")
  }
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
  if err := os.Remove(middle); err != nil {
    t.Fatal(err)
  }
  if err := os.Symlink(second, middle); err != nil {
    t.Fatal(err)
  }
  select {
  case err := <-done:
    if !errors.Is(err, ErrLSPPluginSelectionChanged) {
      t.Fatalf("proxy result = %v, want plugin selection restart", err)
    }
  case <-time.After(5 * time.Second):
    t.Fatal("the proxy did not restart after the non-UTF-8 link changed")
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
