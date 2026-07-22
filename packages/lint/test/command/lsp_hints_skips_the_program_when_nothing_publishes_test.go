package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLSPHintsSkipsTheProgramWhenNothingPublishes verifies the corpus verb
// refuses to build a Program that no declared rule will project.
//
// The witness is a project that cannot load at all: `--tsconfig` names a file
// that does not exist. The verb used to build the engine and then load a Program
// regardless of whether anything could publish hints, so this load failed and
// the sidecar wrote tsgo's error to stderr — for a question whose answer was an
// empty corpus either way. A project with no hint-publishing rule is the common
// case, and ttscserver asks this verb on every save.
//
//  1. Seed a project whose lint config declares no hint-publishing rule.
//  2. Run lsp-hints against a tsconfig path that does not exist.
//  3. Assert an empty corpus, exit 0, and a silent stderr.
func TestLSPHintsSkipsTheProgramWhenNothingPublishes(t *testing.T) {
  root := seedLintProject(t, "export const value = 1;\n")
  seedLintRules(t, root, map[string]string{"no-var": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-hints",
      "--cwd", root,
      "--tsconfig", filepath.Join(root, "no-such-tsconfig.json"),
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 {
    t.Fatalf("lsp-hints exit: want 0, got %d (stderr %q)", code, stderr)
  }
  if strings.TrimSpace(stdout) != "[]" {
    t.Fatalf("corpus: want [], got %q", stdout)
  }
  if stderr != "" {
    t.Fatalf("a project with no hint publisher still reached the Program loader: %q", stderr)
  }
}
