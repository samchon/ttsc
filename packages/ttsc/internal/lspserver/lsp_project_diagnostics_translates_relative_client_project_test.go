package lspserver

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPProjectDiagnosticsTranslatesRelativeClientProject verifies a project
// URI is restated in the client's spelling however the client named it.
//
// The editor is not required to pass an absolute `--tsconfig`; naming the
// project relative to the working directory it also passed is the ordinary
// spelling, and every ttsc CLI accepts it. The translator, however, needs an
// absolute path both to compare against the producer's URI and to build a URI
// from, so a relative spelling used to end the translation and let the sidecar's
// own spelling reach the editor unchanged — the precise failure this whole
// translation exists to prevent, surviving in the common case.
//
// A client that named no directory either is not a case to decline: this host
// was started from that directory and inherited it, so its own working
// directory is the same anchor reached another way.
//
//  1. Resolve a relative project against the directory the client named.
//  2. Resolve one against the directory the host inherited.
//  3. Leave an absolute one exactly as the previous behavior did.
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
  detour := func(directory string) string {
    return projectInputFileURI(
      filepath.Join(directory, "src") +
        string(os.PathSeparator) + ".." +
        string(os.PathSeparator) + "tsconfig.json",
    )
  }
  named := detour(root)
  expected := projectInputFileURI(filepath.Join(root, "tsconfig.json"))
  if named == expected {
    t.Fatalf("the producer URI must differ from the client's to be a test")
  }

  source := &NativePluginSource{
    clientTsconfig: "tsconfig.json",
    clientCwd:      root,
  }
  if got := source.clientProjectURI(named); got != expected {
    t.Fatalf("relative project not translated: got %q, want %q", got, expected)
  }

  working, err := os.Getwd()
  if err != nil {
    t.Fatalf("working directory: %v", err)
  }
  inherited := &NativePluginSource{clientTsconfig: "tsconfig.json"}
  inheritedWant := projectInputFileURI(filepath.Join(working, "tsconfig.json"))
  if got := inherited.clientProjectURI(detour(working)); got != inheritedWant {
    t.Fatalf(
      "inherited directory not used: got %q, want %q",
      got,
      inheritedWant,
    )
  }

  absolute := &NativePluginSource{
    clientTsconfig: filepath.Join(root, "tsconfig.json"),
  }
  if got := absolute.clientProjectURI(named); got != expected {
    t.Fatalf("absolute project no longer translated: got %q, want %q", got, expected)
  }

  // Nothing to translate to, so the producer keeps its own spelling rather than
  // being addressed at a project the client never named.
  unnamed := &NativePluginSource{}
  if got := unnamed.clientProjectURI(named); got != named {
    t.Fatalf("unnamed project was rewritten: got %q, want %q", got, named)
  }
}
