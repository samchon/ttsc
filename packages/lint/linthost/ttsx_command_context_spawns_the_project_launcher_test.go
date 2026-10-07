package linthost

import (
  "context"
  "path/filepath"
  "testing"
)

// TestTtsxCommandContextSpawnsTheProjectLauncher verifies the anchors reach the
// constructed command, not just the resolver.
//
// resolveTtsxLauncher can be right while the command still spawns a bare
// `ttsx`, because the launcher is chosen inside ttsxCommandContext rather than
// passed to it. This pins the wiring: a resolved `.js` launcher also has to be
// handed to node, which shouldRunTtsxThroughNode decides from the extension.
//
//  1. Seed a project holding `ttsc` and its launcher, and shed both variables.
//  2. Build the command the TypeScript config loader would build.
//  3. Assert node receives the project's launcher followed by the arguments.
//
// @evidence contracts/testing.md#behavioral-verification ttsxCommandContext constructs a Node command whose arguments contain the resolved project launcher and preserve both supplied loader arguments; it does not start a process.
// @evidence contracts/testing.md#independent-expectations The JS launcher must be passed as the first Node argument and caller flags must retain their order; the authored launcher path and literal flags supply the independent command-vector oracle.
// @evidence contracts/testing.md#distinguishing-cases Owns project-local .js selection with environment pins cleared and verifies the complete argument count and order; actual child evaluation remains in the executable-config boundary batch.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored temporary JS launcher reaches ttsxCommandContext directly in-process; complete command Args are inspected without Start or Run, so actual child launch remains in executable-config E2E ownership.
func TestTtsxCommandContextSpawnsTheProjectLauncher(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  launcher := seedProjectTtsc(t, root)
  config := filepath.Join(root, "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  cmd := ttsxCommandContext(
    context.Background(),
    configToolAnchors(config, root),
    "--no-plugins",
    "loader.mts",
  )
  want := []string{launcher, "--no-plugins", "loader.mts"}
  if len(cmd.Args) != len(want)+1 {
    t.Fatalf("command args = %v, want the node binary followed by %v", cmd.Args, want)
  }
  for i, argument := range want {
    if cmd.Args[i+1] != argument {
      t.Fatalf("command arg %d = %q, want %q (full: %v)", i+1, cmd.Args[i+1], argument, cmd.Args)
    }
  }
}
