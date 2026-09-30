package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveTtsxLauncherKeepsAnExplicitlyPinnedBinary verifies an explicit
// TTSC_TTSX_BINARY still wins over the project's own install.
//
// The launcher twin of the compiler's pinning guarantee, and the reason the
// repository's own Go lint suite keeps working: scripts/test-go-lint.cjs points
// the variable at the freshly built launcher, which must outrank whatever
// `ttsc` a fixture happens to install.
//
//  1. Seed a project holding a resolvable `ttsc` install.
//  2. Point TTSC_TTSX_BINARY at a different path.
//  3. Assert the pinned path is returned verbatim.
//
// @evidence contracts/testing.md#behavioral-verification resolveTtsxLauncher returns TTSC_TTSX_BINARY verbatim over a different resolvable project launcher.
// @evidence contracts/testing.md#independent-expectations An explicit launcher pin outranks local package lookup; the two authored distinct paths establish precedence independently of the resolver.
// @evidence contracts/testing.md#distinguishing-cases Owns pin-versus-present-project competition, including explicit rejection of selecting the project path; unpinned lookup is checked separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored temporary local launcher and scoped TTSC_TTSX_BINARY pin reach resolveTtsxLauncher in-process; exact pin precedence is observed without executing either launcher.
func TestResolveTtsxLauncherKeepsAnExplicitlyPinnedBinary(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  project := seedProjectTtsc(t, root)
  config := filepath.Join(root, "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  pinned := filepath.Join(root, "pinned", "ttsx.js")
  t.Setenv("TTSC_TTSX_BINARY", pinned)

  got := resolveTtsxLauncher(configToolAnchors(config, root))
  if got == project {
    t.Fatalf("resolveTtsxLauncher took the project launcher %q over the pinned %q", project, pinned)
  }
  if got != pinned {
    t.Fatalf("resolveTtsxLauncher = %q, want the pinned %q", got, pinned)
  }
}
