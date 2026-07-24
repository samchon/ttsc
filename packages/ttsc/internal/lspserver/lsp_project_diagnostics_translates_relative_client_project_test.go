package lspserver

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPProjectDiagnosticsTranslatesRelativeClientProject verifies a project
// URI is restated in the client's spelling even when the client named its
// project relatively.
//
// The editor is not required to pass an absolute `--tsconfig`; naming the
// project relative to the working directory it also passed is the ordinary
// spelling, and every ttsc CLI accepts it. The translator, however, needs an
// absolute path both to compare against the producer's URI and to build a URI
// from, so a relative spelling used to end the translation and let the sidecar's
// own spelling reach the editor unchanged — the precise failure this whole
// translation exists to prevent, surviving in the common case.
//
// The client's working directory is the only anchor that spelling has, so it is
// the one this resolves against.
//
//  1. Give the source a relative project name and the directory it is relative
//     to.
//  2. Publish under a different spelling of the same file.
//  3. Assert the client's spelling comes back, and that without a working
//     directory the producer's spelling is left alone rather than guessed at.
func TestLSPProjectDiagnosticsTranslatesRelativeClientProject(t *testing.T) {
  root := t.TempDir()
  if err := os.WriteFile(
    filepath.Join(root, "tsconfig.json"),
    []byte("{}"),
    0o644,
  ); err != nil {
    t.Fatalf("write tsconfig: %v", err)
  }
  if err := os.Mkdir(filepath.Join(root, "src"), 0o755); err != nil {
    t.Fatalf("make src: %v", err)
  }

  // Spelled through a directory and back out, so it addresses the same file the
  // client does without being the same string.
  producer := projectInputFileURI(
    filepath.Join(root, "src") +
      string(os.PathSeparator) + ".." +
      string(os.PathSeparator) + "tsconfig.json",
  )
  expected := projectInputFileURI(filepath.Join(root, "tsconfig.json"))
  if producer == expected {
    t.Fatalf("the producer URI must differ from the client's to be a test")
  }

  source := &NativePluginSource{
    clientTsconfig: "tsconfig.json",
    clientCwd:      root,
  }
  if got := source.clientProjectURI(producer); got != expected {
    t.Fatalf("relative project not translated: got %q, want %q", got, expected)
  }

  unanchored := &NativePluginSource{clientTsconfig: "tsconfig.json"}
  if got := unanchored.clientProjectURI(producer); got != producer {
    t.Fatalf("unanchored spelling was rewritten: got %q, want %q", got, producer)
  }
}
