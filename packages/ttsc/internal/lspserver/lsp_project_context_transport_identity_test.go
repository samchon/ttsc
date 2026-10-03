package lspserver

import (
  "os/exec"
  "testing"
)

// TestLSPProjectContextTransportIdentityTracksEffectiveArgv verifies resident
// key distinguishes whether supplied project context would be passed. Its
// failed-start resident calls create two keyed records, not two live sessions.
//
// @evidence contracts/testing.md#behavioral-verification Two entries differing in name and ProjectContextArgs share a key without context but differ with the supplied nonempty context. Direct serveRun calls then leave two keyed resident records despite failed starts. Actual child argv or successful session reuse is not observed.
// @evidence contracts/testing.md#independent-expectations Literal equality without context, inequality with context and record count two express the supplied transport policy. Key strings are not copied from the implementation, and the missing binary premise is checked before native start attempts.
// @evidence contracts/testing.md#distinguishing-cases Absent context makes the differing flag dormant; supplied context makes it effective. The same missing binary is used for both entries, whose names also differ. Empty or whitespace context and distinct context payload contents are outside this matrix.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls pluginKey and NativePluginSource.serveRun with an owned temporary cwd and descriptors. Actual command setup and failed native Start attempts are reached; no child successfully starts under the checked missing-binary premise, and no consumer or product host is installed.
func TestLSPProjectContextTransportIdentityTracksEffectiveArgv(t *testing.T) {
  withoutContext := NativeLSPPluginEntry{
    Binary: "ttsc-no-such-shared-sidecar",
    Name:   "@ttsc/without-context",
  }
  if path, err := exec.LookPath(withoutContext.Binary); err == nil {
    t.Fatalf("missing-binary premise is false: %s", path)
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
