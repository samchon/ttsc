package strip_test

import (
  "context"
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestTtsxCommandContextRoutesAScriptLauncherThroughNode verifies that the
// launcher command runs a script launcher under node and any other binary
// directly.
//
// Resolving a launcher does not establish command argument wiring. A `.js`
// launcher is not executable on its own, so it must be the first argument of
// the node binary, while a pinned native binary must be the program itself with
// no node in front. This case inspects exec.Cmd.Args without starting either.
//
//  1. Seed the project launcher, clear both tool overrides and pin
//     TTSC_NODE_BINARY to a literal name.
//  2. Construct the command for --no-plugins and loader.mts and assert the node
//     name, the launcher and the caller arguments in order.
//  3. Pin TTSC_TTSX_BINARY to a non-script name and assert the command is that
//     name followed by the caller arguments alone.
//
// @evidence contracts/testing.md#behavioral-verification Constructs commands with stripTtsxCommandContext and asserts the exact Args: pinned node name, project launcher, --no-plugins, loader.mts for a discovered .js launcher, and the pinned native name followed by the same two arguments when TTSC_TTSX_BINARY names a non-script binary.
// @evidence contracts/testing.md#independent-expectations The node name and the native name are literals chosen by the case, and the launcher path is the independently seeded fixture file, so the expected argv follows from the routing contract and not from the implementation's output.
// @evidence contracts/testing.md#distinguishing-cases Owns script-launcher routing through node against direct-binary routing without node, with the same caller arguments in both. Actual child output and exit status are owned by the loader boundary cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestTtsxCommandContextRoutesAScriptLauncherThroughNode is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. It runs stripTtsxCommandContext and launcher resolution in the Go process and never calls Run, Output or Start, so nothing is spawned.
func TestTtsxCommandContextRoutesAScriptLauncherThroughNode(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  t.Setenv("TTSC_NODE_BINARY", "node-under-test")
  root := shared.StripRealpathIfPossible(t.TempDir())
  launcher := seedProjectTtsc(t, root)
  config := filepath.Join(root, "strip.config.ts")
  shared.WriteFile(t, config, "export default {};\n")
  anchors := shared.StripConfigToolAnchors(config, root)

  assertArgs := func(label string, got []string, want []string) {
    t.Helper()
    if len(got) != len(want) {
      t.Fatalf("%s: command args = %v, want %v", label, got, want)
    }
    for i := range want {
      if got[i] != want[i] {
        t.Fatalf("%s: arg %d = %q, want %q (full: %v)", label, i, got[i], want[i], got)
      }
    }
  }

  cmd := stripTtsxCommandContext(context.Background(), anchors, "--no-plugins", "loader.mts")
  assertArgs("script launcher", cmd.Args, []string{"node-under-test", launcher, "--no-plugins", "loader.mts"})

  t.Setenv("TTSC_TTSX_BINARY", "ttsx-native-under-test")
  cmd = stripTtsxCommandContext(context.Background(), anchors, "--no-plugins", "loader.mts")
  assertArgs("native launcher", cmd.Args, []string{"ttsx-native-under-test", "--no-plugins", "loader.mts"})
}
