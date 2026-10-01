package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestResolveTtsxLauncherKeepsAnExplicitlyPinnedBinary verifies an explicit
// TTSC_TTSX_BINARY still wins over the project's own install.
//
// The launcher twin of the compiler's pinning guarantee, and the reason a
// plugin spawned by ttsc keeps using the launcher that spawned it: the host
// exports the variable into every plugin process, and that launcher must
// outrank whatever `ttsc` the compiled project happens to install.
//
//  1. Seed a project holding a resolvable `ttsc` install.
//  2. Point TTSC_TTSX_BINARY at a different path.
//  3. Assert the pinned path is returned verbatim.
//
// @evidence contracts/testing.md#behavioral-verification Sets TTSC_TTSX_BINARY with a competing seeded project launcher and asserts stripResolveTtsxLauncher returns exactly the pinned path, not the project path.
// @evidence contracts/testing.md#independent-expectations The explicit launcher override outranks anchor discovery. The two expected identities are distinct paths fixed before lookup.
// @evidence contracts/testing.md#distinguishing-cases Owns nonempty override priority against a valid project launcher; empty-environment discovery and missing-launcher fallback are separate cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveTtsxLauncherKeepsAnExplicitlyPinnedBinary is selected from test/unit by the utility runner unit overlay. Runs stripResolveTtsxLauncher in the Go process with testing-restored environment; neither launcher is invoked.
func TestResolveTtsxLauncherKeepsAnExplicitlyPinnedBinary(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.StripRealpathIfPossible(t.TempDir())
  project := seedProjectTtsc(t, root)
  config := filepath.Join(root, "strip.config.ts")
  shared.WriteFile(t, config, "export default {};\n")

  pinned := filepath.Join(root, "pinned", "ttsx.js")
  t.Setenv("TTSC_TTSX_BINARY", pinned)

  got := stripResolveTtsxLauncher(shared.StripConfigToolAnchors(config, root))
  if got == project {
    t.Fatalf("stripResolveTtsxLauncher took the project launcher %q over the pinned %q", project, pinned)
  }
  if got != pinned {
    t.Fatalf("stripResolveTtsxLauncher = %q, want the pinned %q", got, pinned)
  }
}
