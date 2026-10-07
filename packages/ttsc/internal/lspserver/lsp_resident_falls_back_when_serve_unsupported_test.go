package lspserver

import (
  "bytes"
  "os/exec"
  "testing"
)

// TestResidentFallsBackWhenServeUnsupported verifies failed resident launch
// reports served=false and records unsupported transport state.
//
// A resident child can fail to spawn. serveRun reports served=false so its
// caller can choose direct execution, and marks a transport unsupported when
// it never answered. This case observes the marker without launching a real
// older sidecar or counting subsequent failed launch attempts.
//
// A missing executable exercises launch failure, not an actual sidecar's
// unsupported-verb reply. The unit calls serveRun directly, so it does not
// observe run's later spawn-per-verb fallback or successful diagnostics.
//
//  1. serveRun a read verb against a plugin whose binary cannot launch.
//  2. Assert it reports served=false (the caller falls back to exec).
//  3. Assert unsupported state, then assert served=false on a second call.
//
// @evidence contracts/testing.md#behavioral-verification Both direct serveRun calls report served=false, and the first establishes the unsupported marker for the authored transport. Actual fallback execution and second-call launch counts are not asserted.
// @evidence contracts/testing.md#independent-expectations Literal false outcomes and a literal transport-key lookup check the recorded unsupported state. exec.LookPath separately requires the authored binary to be unresolvable before exercising launch failure.
// @evidence contracts/testing.md#distinguishing-cases The first call begins without unsupported state; the second begins after that marker is observed. A real unsupported reply, successful resident and actual direct fallback are outside these assertions.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit calls actual serveRun with an owned source and bytes buffer. The native command launch is attempted only after independently confirming the executable is missing; no fixture is compiled, consumer installed, successful sidecar started or product host run, and no operation is substituted.
func TestResidentFallsBackWhenServeUnsupported(t *testing.T) {
  source := &NativePluginSource{err: &bytes.Buffer{}}
  plugin := NativeLSPPluginEntry{Binary: "ttsc-no-such-serve-binary", Name: "@ttsc/legacy"}
  if resolved, err := exec.LookPath(plugin.Binary); err == nil {
    t.Fatalf("missing executable premise failed: %q resolves to %q", plugin.Binary, resolved)
  }

  if _, served, _ := source.serveRun(plugin, serveVerbDiagnostics, []string{"--uri=file:///a.ts"}); served {
    t.Fatal("a sidecar that cannot spawn must fall back to exec (served=false)")
  }

  source.residentMu.Lock()
  unsupported := source.serveUnsupported["ttsc-no-such-serve-binary\x000"]
  source.residentMu.Unlock()
  if !unsupported {
    t.Fatal("a first-spawn failure must mark lsp-serve unsupported so the source stops retrying")
  }

  if _, served, _ := source.serveRun(plugin, serveVerbDiagnostics, []string{"--uri=file:///a.ts"}); served {
    t.Fatal("a binary already marked unsupported must keep falling back")
  }
}
