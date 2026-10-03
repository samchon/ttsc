package lspserver

import "testing"

// TestLSPProjectContextTransportIdentityTracksEffectiveArgv verifies resident
// identity follows the actual launch arguments, not a dormant capability flag.
//
// @evidence contracts/testing.md#behavioral-verification The resident identity follows the actual launch arguments rather than a dormant capability flag.
// @evidence contracts/testing.md#independent-expectations The expected identities are compared across argument lists written literally in the test.
// @evidence contracts/testing.md#distinguishing-cases A flag that is present but unused and the same flag actually passed differ in identity.
// @evidence contracts/testing.md#execution-ownership TestLSPProjectContextTransportIdentityTracksEffectiveArgv is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPProjectContextTransportIdentityTracksEffectiveArgv(t *testing.T) {
  withoutContext := NativeLSPPluginEntry{
    Binary: "ttsc-no-such-shared-sidecar",
    Name:   "@ttsc/without-context",
  }
  withContext := withoutContext
  withContext.Name = "@ttsc/with-context"
  withContext.ProjectContextArgs = true

  if pluginKey(withoutContext) != pluginKey(withContext) {
    t.Fatal("an absent project context split identical launch transports")
  }
  projectContextJSON := `{"physicalProjectRoot":"/project"}`
  if pluginKey(withoutContext, projectContextJSON) ==
    pluginKey(withContext, projectContextJSON) {
    t.Fatal("effective project-context argv did not distinguish transports")
  }

  source := &NativePluginSource{
    cwd:                t.TempDir(),
    pluginsJSON:        "[]",
    projectContextJSON: projectContextJSON,
  }
  _, _, _ = source.serveRun(
    withoutContext,
    serveVerbDiagnostics,
    []string{"--uri=file:///project/a.ts"},
  )
  _, _, _ = source.serveRun(
    withContext,
    serveVerbDiagnostics,
    []string{"--uri=file:///project/a.ts"},
  )
  if len(source.residents) != 2 {
    t.Fatalf("differing launch argv shared %d resident sessions", len(source.residents))
  }
}
