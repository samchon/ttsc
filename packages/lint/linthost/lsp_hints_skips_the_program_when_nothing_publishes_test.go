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
//
// @evidence contracts/testing.md#behavioral-verification lsp-hints returns the empty corpus with status 0 and silent stderr despite a nonexistent tsconfig when no rule publishes hints.
// @evidence contracts/testing.md#independent-expectations The authored nonexistent config and absent publisher establish that Program loading must not occur; literal empty output is an independent short-circuit expectation.
// @evidence contracts/testing.md#distinguishing-cases The only enabled rule is no-var, which publishes no hints, and the tsconfig path does not exist, so any Program load would write a loader error and fail; the required exit 0, an empty array and silent stderr show the load was skipped. The declared-publisher counterpart that must still fail is owned by the still-loads test.
// @evidence contracts/testing.md#execution-ownership Calls run lsp-hints in process with a nonexistent tsconfig path and captured streams; no Program can be loaded, and no editor or built host is started.
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
