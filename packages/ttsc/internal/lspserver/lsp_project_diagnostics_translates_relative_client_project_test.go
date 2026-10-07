package lspserver

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPProjectDiagnosticsTranslatesRelativeClientProject verifies a project
// URI uses the supplied client anchor in four direct translation cases.
//
// The editor is not required to pass an absolute `--tsconfig`; naming the
// project relative to a supplied working directory is one input to this unit.
// The translator needs an
// absolute path both to compare against the producer's URI and to build a URI
// from, so a relative spelling must not end the translation and let the
// sidecar's own spelling reach the editor unchanged — the precise failure this
// direct translation distinguishes from leaving the producer detour unchanged.
//
// With no supplied directory, the direct operation uses this test process's
// actual working directory. No launcher inheritance or editor is executed.
//
//  1. Resolve a relative project against the directory the client named.
//  2. Resolve one against the directory the host inherited.
//  3. Translate an absolute one the same way.
//
// @evidence contracts/testing.md#behavioral-verification clientProjectURI rewrites a distinct producer detour to the expected client URI for supplied-relative, ambient-cwd-relative and absolute client paths; with no client project it preserves the producer string. This does not observe CLI admission or editor delivery.
// @evidence contracts/testing.md#independent-expectations Expected anchor paths come from the owned root or os.Getwd plus literal tsconfig.json, separately from clientProjectURI. Input and expected URI serialization share projectInputFileURI, so this is an anchor/rewrite oracle, not an independent URI-encoder oracle. The distinct input/output premise is explicitly checked for the root detour.
// @evidence contracts/testing.md#distinguishing-cases Supplied directory, omitted directory using actual process cwd, absolute project and absent project are the four cases. The temporary root has a config and src directory; the ambient-cwd case relies on the native ancestor-fallback identity operation rather than creating a real client project there.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit calls actual NativePluginSource.clientProjectURI with owned native filesystem inputs and reads process cwd for one case. It installs no consumer, starts no child or host and uses no substitute translation operation; native identity may query owning-directory case flags on Windows.
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
    t.Fatalf("absolute project not translated: got %q, want %q", got, expected)
  }

  // Nothing to translate to, so the producer keeps its own spelling rather than
  // being addressed at a project the client never named.
  unnamed := &NativePluginSource{}
  if got := unnamed.clientProjectURI(named); got != named {
    t.Fatalf("unnamed project was rewritten: got %q, want %q", got, named)
  }
}
