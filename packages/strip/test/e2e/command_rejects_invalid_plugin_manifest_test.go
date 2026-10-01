package strip_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsInvalidPluginManifest rejects malformed strip plugin manifests.
//
// The wrapper dispatches build, transform, and check into the shared utility host. A malformed
// plugin manifest exercises the failure return from each command without depending on strip
// rewrites, TypeScript diagnostics, or emitted output.
//
// This covers the command paths that existing happy cases reach only on success. Each branch
// should preserve the utility error status and avoid writing host-facing stdout payloads.
//
// 1. Invoke build, transform, and check with malformed --plugins-json input.
// 2. Capture each command's status and streams through the real wrapper.
// 3. Assert every command returns the utility failure status and invalid-manifest diagnostic.
// @evidence contracts/testing.md#behavioral-verification Each compiled strip build, transform and check command receives --plugins-json={ and must return status 2, empty stdout and ttsc utility: invalid --plugins-json.
// @evidence contracts/testing.md#independent-expectations The single opening brace is deliberately malformed JSON; literal status and utility diagnostic establish failure independently of parser internals.
// @evidence contracts/testing.md#distinguishing-cases All three delegating commands (build, transform, check) are given the same malformed manifest and fail before LoadProgram runs (host.go parsePluginEntries precedes driver.LoadProgram); no project is supplied, and no valid-manifest case runs in this body.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsInvalidPluginManifest entry runs in the strip E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The three consumers verify each wrapper branch returns the utility manifest failure over its actual process channels. JSON rejection semantics are portable; repeated protocol invocations are retained here without claiming they are minimal.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts three processes (build, transform, check), one per loop iteration, from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The function creates no fixture; each of the three processes exits before the next loop iteration. TestMain removes only the fallback producer directory after m.Run, and a TTSC_UTILITY_TEST_BINARY binary stays with its supplier. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The status, empty-stdout and diagnostic checks for each of the three commands are made in the loop at L32-35 of this body; nothing is delegated to a unit test or helper.
func TestCommandRejectsInvalidPluginManifest(t *testing.T) {
  // Failure assertion: parsePluginEntries runs before project loading, keeping
  // the scenario narrow and stable across strip fixture changes.
  for _, command := range []string{"build", "transform", "check"} {
    code, stdout, stderr := runPlugin(t, command, "--plugins-json={")
    if code != 2 || stdout != "" || !strings.Contains(stderr, "ttsc utility: invalid --plugins-json") {
      t.Fatalf("%s invalid manifest mismatch: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
    }
  }
}
