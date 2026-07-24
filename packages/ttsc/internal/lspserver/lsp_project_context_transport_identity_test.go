package lspserver

import "testing"

// TestLSPProjectContextTransportIdentityTracksEffectiveArgv verifies resident
// identity follows the actual launch arguments, not a dormant capability flag.
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
