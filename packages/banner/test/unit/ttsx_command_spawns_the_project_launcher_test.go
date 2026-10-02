package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestTtsxCommandSpawnsTheProjectLauncher verifies the command built for a
// project-installed launcher routes it through Node with the caller's arguments.
//
// Resolving a launcher does not establish command argument wiring. This case
// inspects exec.Cmd.Args without starting the command, so it proves the
// command line a spawn would use and not the spawn itself.
//
//  1. Seed the project launcher and clear both tool overrides.
//  2. Construct the command for --no-plugins and loader.mts.
//  3. Assert the launcher path and caller argument suffix retain their order.
//
// @evidence contracts/testing.md#behavioral-verification Constructs a command with bannerTtsxCommand after clearing tool variables and asserts count and ordered launcher, --no-plugins, loader.mts argument suffix.
// @evidence contracts/testing.md#independent-expectations A project .js launcher occupies the first argument after the Node executable and preserves caller arguments. The expected suffix is listed independently; executable identity itself is not asserted.
// @evidence contracts/testing.md#distinguishing-cases Owns construction from a discovered project script launcher; direct-executable routing and actual child output/status are owned by loader boundary cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestTtsxCommandSpawnsTheProjectLauncher is selected from test/unit by the root test:go command (`go test ./packages/banner/...`). Runs bannerTtsxCommand, launcher resolution and exec.Cmd construction in the Go process. This entry never calls Run, Output or Start and proves no spawn.
func TestTtsxCommandSpawnsTheProjectLauncher(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.BannerRealpathIfPossible(t.TempDir())
  launcher := seedProjectTtsc(t, root)
  config := filepath.Join(root, "banner.config.ts")
  shared.WriteFile(t, config, "export default { text: \"from ts\" };\n")

  cmd := shared.BannerTtsxCommand(
    shared.BannerConfigToolAnchors(config, root),
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
